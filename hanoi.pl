% hanoi.pl - Pure Tower of Hanoi logic. No HTTP code lives here.
%
% Conventions used everywhere in the project:
%   * Towers are the atoms a, b and c.
%   * Disks are integers; 1 is the smallest, N is the largest.
%   * A puzzle state is a dict _{a:[...], b:[...], c:[...]} where each list
%     holds the disks of that tower with the TOP disk FIRST, e.g. [1,2,3].

:- module(hanoi, [
    solve/4,          % solve(+N, +From, +To, -Moves)
    minimum_moves/2,  % minimum_moves(+N, -Min)
    check_move/4,     % check_move(+State, +From, +To, -Reason)
    apply_move/4,     % apply_move(+State, +From, +To, -NewState)
    is_solved/2,      % is_solved(+State, +Target)
    tower/1
]).

tower(a).
tower(b).
tower(c).

%! hanoi(+N, +From, +To, +Via, -Moves)
%  Classic recursion: move N-1 disks out of the way, move the biggest disk,
%  then move the N-1 disks on top of it.
hanoi(0, _, _, _, []) :- !.
hanoi(N, From, To, Via, Moves) :-
    N > 0,
    N1 is N - 1,
    hanoi(N1, From, Via, To, Before),
    hanoi(N1, Via, To, From, After),
    append(Before, [move(N, From, To)], Middle),
    append(Middle, After, Moves).

%! solve(+N, +From, +To, -Moves) is semidet.
solve(N, From, To, Moves) :-
    integer(N), N >= 0,
    tower(From), tower(To), From \== To,
    tower(Via), Via \== From, Via \== To, !,
    hanoi(N, From, To, Via, Moves).

%! minimum_moves(+N, -Min): 2^N - 1
minimum_moves(N, Min) :- Min is (1 << N) - 1.

% ---------------------------------------------------------------- validation

legal_stack(Stack) :-
    is_list(Stack),
    maplist(integer, Stack),
    sort(Stack, Sorted),          % sort/2 removes duplicates, so equality
    Sorted == Stack.              % means "strictly ascending" (top = smallest)

legal_state(State) :-
    is_dict(State),
    forall(tower(T), ( get_dict(T, State, Stack), legal_stack(Stack) )).

%! check_move(+State, +From, +To, -Reason)
%  Always succeeds. Reason is `ok` or a human-readable explanation.
check_move(State, _, _, 'The puzzle state is invalid.') :-
    \+ legal_state(State), !.
check_move(_, From, To, 'Towers must be a, b or c.') :-
    ( \+ tower(From) ; \+ tower(To) ), !.
check_move(_, T, T, 'Pick a different destination tower.') :- !.
check_move(State, From, _, 'That tower has no disks to move.') :-
    get_dict(From, State, []), !.
check_move(State, From, To, 'A larger disk cannot go on a smaller disk.') :-
    get_dict(From, State, [Moving|_]),
    get_dict(To, State, [Top|_]),
    Top < Moving, !.
check_move(_, _, _, ok).

%! apply_move(+State, +From, +To, -NewState)
%  Assumes check_move/4 returned ok.
apply_move(State, From, To, NewState) :-
    get_dict(From, State, [Disk|Rest]),
    get_dict(To, State, Destination),
    put_dict(From, State, Rest, Mid),
    put_dict(To, Mid, [Disk|Destination], NewState).

%! is_solved(+State, +Target): every disk is on the Target tower.
is_solved(State, Target) :-
    findall(Len, ( tower(T), get_dict(T, State, S), length(S, Len) ), Lens),
    sum_list(Lens, Total),
    get_dict(Target, State, OnTarget),
    length(OnTarget, Total),
    Total > 0.
