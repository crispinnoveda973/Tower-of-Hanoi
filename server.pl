% server.pl - HTTP server for the Tower of Hanoi app.
%
% Start it with:   swipl server.pl
% Then open:       http://localhost:8080
%
% Endpoints (all return JSON):
%   GET  /api/health                      -> {status:"ok"}
%   GET  /api/info?disks=N                -> {disks, minimum}
%   GET  /api/solve?disks=N&from=a&to=c   -> {disks, moves:[{disk,from,to}], count, minimum}
%   POST /api/validate                    -> checks + applies one manual move
% Everything else is served as a static file from ../frontend.

:- use_module(library(http/thread_httpd)).
:- use_module(library(http/http_dispatch)).
:- use_module(library(http/http_json)).
:- use_module(library(http/http_files)).
:- use_module(library(http/http_parameters)).
:- use_module(library(http/http_cors)).
:- use_module(hanoi).

:- set_setting(http:cors, [*]).

default_port(8080).
max_disks(10).

% Remember where the frontend folder is, relative to this file.
:- dynamic frontend_dir/1.
:- prolog_load_context(directory, Dir),
   atomic_list_concat([Dir, '/../frontend'], Relative),
   absolute_file_name(Relative, Absolute),
   assertz(frontend_dir(Absolute)).

:- http_handler(root(api/health),   api_health,   []).
:- http_handler(root(api/info),     api_info,     []).
:- http_handler(root(api/solve),    api_solve,    []).
:- http_handler(root(api/validate), api_validate, [method(post)]).
:- http_handler(root(.),            serve_static, [prefix]).

% ------------------------------------------------------------------ helpers

bad_request(Message) :-
    reply_json_dict(_{error: Message}, [status(400)]).

%  Accept only whole numbers from 1 to max_disks.
parse_disks(Atom, N) :-
    atom_number(Atom, N),
    integer(N),
    max_disks(Max),
    between(1, Max, N).

disks_message(Message) :-
    max_disks(Max),
    format(atom(Message), 'The number of disks must be a whole number from 1 to ~d.', [Max]).

move_json(move(Disk, From, To), _{disk: Disk, from: From, to: To}).

% ---------------------------------------------------------------- handlers

serve_static(Request) :-
    frontend_dir(Dir),
    http_reply_from_files(Dir, [indexes(['index.html'])], Request).

api_health(_Request) :-
    cors_enable,
    reply_json_dict(_{status: ok, solver: 'SWI-Prolog'}).

api_info(Request) :-
    cors_enable,
    http_parameters(Request, [disks(Raw, [default('3')])]),
    (   parse_disks(Raw, N)
    ->  minimum_moves(N, Min),
        reply_json_dict(_{disks: N, minimum: Min})
    ;   disks_message(Msg), bad_request(Msg)
    ).

api_solve(Request) :-
    cors_enable,
    http_parameters(Request, [ disks(Raw, [default('3')]),
                               from(From, [default(a)]),
                               to(To, [default(c)]) ]),
    (   parse_disks(Raw, N)
    ->  (   solve(N, From, To, Moves)
        ->  length(Moves, Count),
            minimum_moves(N, Min),
            maplist(move_json, Moves, MoveList),
            reply_json_dict(_{ disks: N, from: From, to: To,
                               moves: MoveList, count: Count, minimum: Min })
        ;   bad_request('"from" and "to" must be two different towers (a, b or c).')
        )
    ;   disks_message(Msg), bad_request(Msg)
    ).

%  Body: {"state":{"a":[1,2,3],"b":[],"c":[]}, "from":"a", "to":"b", "target":"c"}
api_validate(Request) :-
    cors_enable,
    catch(http_read_json_dict(Request, In, [value_string_as(atom)]), _, fail),
    validate_request(In, Out),
    !,
    reply_json_dict(Out).
api_validate(_Request) :-
    bad_request('Malformed request. Expected JSON with state, from and to.').

validate_request(In, Out) :-
    is_dict(In),
    get_dict(state, In, State),
    get_dict(from, In, From),
    get_dict(to, In, To),
    (   get_dict(target, In, Target) -> true ; Target = c ),
    check_move(State, From, To, Reason),
    (   Reason == ok
    ->  get_dict(From, State, [Disk|_]),
        apply_move(State, From, To, NewState),
        (   is_solved(NewState, Target) -> Solved = true ; Solved = false ),
        Out = _{ valid: true, state: NewState, solved: Solved,
                 move: _{disk: Disk, from: From, to: To} }
    ;   Out = _{ valid: false, reason: Reason }
    ).

% -------------------------------------------------------------------- main

start_server(Port) :-
    catch(http_server(http_dispatch, [port(Port)]), Error,
          ( print_message(error, Error),
            format(user_error,
                   'Could not start on port ~w. Is another program using it?~n', [Port]),
            halt(1) )).

main :-
    default_port(Port),
    start_server(Port),
    format('Tower of Hanoi server running at http://localhost:~w~n', [Port]),
    format('Press Ctrl+C twice to stop.~n'),
    thread_get_message(_).     % keep the process alive

:- initialization(main, main).
