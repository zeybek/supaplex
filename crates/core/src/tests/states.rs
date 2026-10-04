//! States the game itself never reaches, set by hand: the rules must leave
//! them be, never panic or reach outside their memory. And corners only
//! a broken level gets to, reached through the crate's insides.
use crate::board::{Board, W};
use crate::tiles::*;
use crate::*;

/// A level from a picture, in a field of hardware, started.
fn start(rows: &[&str]) -> Box<Machine> {
    let mut level = [0u8; LEVEL_BYTES];
    level[..CELLS].fill(HARDWARE);
    for (y, row) in rows.iter().enumerate() {
        for (x, ch) in row.chars().enumerate() {
            level[(y + 1) * W as usize + x + 1] = match ch {
                ' ' => EMPTY,
                'M' => MURPHY,
                'O' => ZONK,
                'o' => ORANGE_DISK,
                'S' => SNIK_SNAK,
                _ => HARDWARE,
            };
        }
    }
    let mut m = Box::new(Machine::new());
    m.start(&level, 1);
    m
}

fn at(x: i32, y: i32) -> i32 {
    (y + 1) * W + x + 1
}

#[test]
fn memory_far_off_the_board_reads_as_nothing_and_takes_no_writes() {
    let mut board = Board::new();
    for cell in [i32::MIN / 4, i32::MAX / 4] {
        board.set(cell, 0x1234);
        assert_eq!(board.word(cell), 0);
    }
}

#[test]
fn an_enemy_in_a_state_the_game_never_gives_one_stays_put() {
    let mut m = start(&["HHH", "HSH", "HHH", "M"]);
    let c = at(1, 1);
    m.board.set(c, with_state(SNIK_SNAK, 0x30));
    m.frame(0);
    assert_eq!(m.board.word(c), with_state(SNIK_SNAK, 0x30));
}

#[test]
fn an_orange_disk_waiting_to_fall_rests_again_if_its_way_is_cleared() {
    let mut m = start(&["o", " ", "H", "M"]);
    let c = at(0, 0);
    // About to fall, but the cell kept for it below has been emptied.
    m.board.set(c, with_state(ORANGE_DISK, 0x20));
    m.board.set(c + W, 0);
    m.frame(0);
    assert_eq!(m.board.word(c), at_rest(ORANGE_DISK));
}

#[test]
fn a_zonk_frozen_in_its_fall_stops_at_the_end_of_the_cell() {
    let mut m = start(&["O", " ", " ", " ", "H", "M"]);
    let top = at(0, 0);
    while m.board.tile(top + W) != ZONK {
        m.frame(0);
    }
    m.level[LEVEL_FREEZE_ZONKS] = 2;
    for _ in 0..40 {
        m.frame(0);
    }
    assert_eq!(m.board.word(top + W), at_rest(ZONK));
    assert_eq!(m.board.word(top + 2 * W), 0, "it fell no further");
}

#[test]
fn murphy_gone_from_his_cell_with_no_cause_dies_of_a_blast() {
    let mut m = start(&["M "]);
    let cell = m.murphy();
    m.board.set(cell, 0);
    m.frame(0);
    assert!(m.killed());
    assert_eq!(m.death(), (DEATH_BLAST, cell));
}

#[test]
fn murphy_in_a_move_the_game_has_no_name_for_just_ends_it() {
    // Waiting, in a state that is neither a push nor a red disk.
    let mut m = start(&["M "]);
    let cell = m.murphy();
    m.board.set(cell, with_state(MURPHY, 0x0d));
    m.wait = 2;
    m.frame(0);
    assert_eq!(m.board.word(cell), with_state(MURPHY, 0x0d));
    // At its end, a state no move ends with: the game takes him as leaving.
    let mut m = start(&["M "]);
    let cell = m.murphy();
    m.board.set(cell, with_state(MURPHY, 0x3f));
    m.anim_len = 1;
    m.frame(0);
    assert_eq!(m.board.word_var(board::Var::Leave), 1);
}

#[test]
fn murphy_lost_after_the_level_is_won_is_no_death() {
    let mut m = start(&["M "]);
    let cell = m.murphy();
    m.completed = true;
    m.board.set(cell, 0);
    m.frame(0);
    assert!(!m.killed());
    assert_eq!(m.death(), (0, 0));
}

#[test]
fn a_blast_centred_on_hardware_does_nothing() {
    let mut m = start(&["M"]);
    let wall = at(1, 1);
    m.explode(wall, DEATH_BLAST);
    assert_eq!(m.board.word(wall), at_rest(HARDWARE));
    assert!(!m.killed());
}

#[test]
fn a_blast_takes_what_a_rolling_thing_had_kept() {
    // An Infotron rolling in from the right, a Zonk about to roll right and
    // one rolling in from the left, caught by a blast: the cells they had
    // kept are let go.
    let mut m = start(&["   ", "   ", "   ", "HHH", "M"]);
    let rolling = at(1, 2);
    m.board.set(rolling, with_state(ZONK, 0x30));
    let infotron = at(0, 1);
    m.board.set(infotron, with_state(INFOTRON, 0x20));
    m.board.set(infotron + 1, ROLLED_FROM);
    let zonk = at(2, 1);
    m.board.set(zonk, with_state(ZONK, 0x60));
    m.board.set(zonk + 1, RESERVED);
    m.explode(at(1, 1), DEATH_BLAST);
    assert_eq!(m.board.tile(infotron), EXPLOSION);
    assert_eq!(m.board.tile(zonk), EXPLOSION);
    assert_eq!(m.board.tile(rolling), EXPLOSION);
}
