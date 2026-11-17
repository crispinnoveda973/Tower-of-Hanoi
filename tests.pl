% tests.pl - Checks the solver without needing the web server.
% Run:  swipl tests.pl

:- use_module(hanoi).

initial_state(N, _{a: Disks, b: [], c: []}) :- numlist(1, N, Disks).

% Apply one solver move, checking it is legal and moves the disk it claims.
step(move(Disk, From, To), State0, State) :-
    check_move(State0, From, To, ok),
    get_dict(From, State0, [Disk|_]),
    apply_move(State0, From, To, State).

test_disks(N) :-
    solve(N, a, c, Moves),
    length(Moves, Count),
    minimum_moves(N, Min),
    Count =:= Min,
    initial_state(N, Start),
    foldl(step, Moves, Start, End),
    is_solved(End, c),
    format('PASS  ~d disk(s): ~d moves (2^~d - 1), all legal, all disks on C~n', [N, Count, N]).

test_rules :-
    S = _{a: [2,3], b: [1], c: []},
    check_move(S, a, b, R1), R1 \== ok,           % larger onto smaller
    check_move(S, c, a, R2), R2 \== ok,           % empty source
    check_move(S, a, a, R3), R3 \== ok,           % same tower
    check_move(S, x, a, R4), R4 \== ok,           % unknown tower
    check_move(S, b, a, ok),                      % smaller onto larger
    format('PASS  rule checks (invalid moves rejected, valid move accepted)~n').

run :-
    forall(between(1, 10, N), ( test_disks(N) -> true ; format('FAIL  ~d disks~n', [N]), halt(1) )),
    ( test_rules -> true ; format('FAIL  rule checks~n'), halt(1) ),
    format('All tests passed.~n').

:- initialization((run, halt)).
