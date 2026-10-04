//! Moments of play the recordings happen not to show, set up in small
//! levels: pushing every kind of disk every way, special ports, the exit,
//! and the near misses where the game spares Murphy.
use crate::board::W;
use crate::tiles::*;
use crate::*;

const UP: u8 = 1;
const LEFT: u8 = 2;
const DOWN: u8 = 3;
const RIGHT: u8 = 4;

/// A level from a picture, from (0, 0) in a field of hardware, unstarted.
fn level(rows: &[&str]) -> [u8; LEVEL_BYTES] {
    let mut level = [0u8; LEVEL_BYTES];
    level[..CELLS].fill(HARDWARE);
    for (y, row) in rows.iter().enumerate() {
        for (x, ch) in row.chars().enumerate() {
            level[at(x as i32, y as i32) as usize] = match ch {
                ' ' => EMPTY,
                'M' => MURPHY,
                'O' => ZONK,
                '@' => INFOTRON,
                'E' => EXIT,
                'o' => ORANGE_DISK,
                'y' => YELLOW_DISK,
                'S' => SNIK_SNAK,
                '>' => PORT_RIGHT,
                _ => HARDWARE,
            };
        }
    }
    level
}

fn at(x: i32, y: i32) -> i32 {
    (y + 1) * W + x + 1
}

fn started(level: &[u8; LEVEL_BYTES]) -> Box<Machine> {
    let mut m = Box::new(Machine::new());
    m.start(level, 1);
    m
}

/// Play `frames` frames on one key; every event of them.
fn hold(m: &mut Machine, key: u8, frames: usize) -> u32 {
    let mut events = 0;
    for _ in 0..frames {
        m.frame(key);
        events |= m.events();
    }
    events
}

#[test]
fn yellow_disks_go_up_and_down() {
    let mut m = started(&level(&[" ", "y", "M"]));
    hold(&mut m, UP, 30);
    assert_eq!(m.tile(at(0, 0)), YELLOW_DISK);
    let mut m = started(&level(&["M", "y", " "]));
    hold(&mut m, DOWN, 30);
    assert_eq!(m.tile(at(0, 2)), YELLOW_DISK);
}

#[test]
fn orange_disks_go_left_and_right_but_not_right_over_a_hole() {
    let mut m = started(&level(&[" oM"]));
    hold(&mut m, LEFT, 30);
    assert_eq!(m.tile(at(0, 0)), ORANGE_DISK);
    assert_eq!(m.murphy(), at(1, 0));

    // Pushed over a hole, it falls at once, and goes off where it lands.
    let mut m = started(&level(&["Mo  ", "HH  ", "HHHH"]));
    let events = hold(&mut m, RIGHT, 9) | hold(&mut m, 0, 40);
    assert_ne!(events & EV_PUSH, 0);
    assert_ne!(events & EV_EXPLOSION, 0);

    let mut m = started(&level(&["Mo ", "H  "]));
    assert_eq!(hold(&mut m, RIGHT, 20) & EV_PUSH, 0);
}

#[test]
fn a_frozen_zonk_over_a_hole_is_not_pushed_right() {
    let mut level = level(&["MO ", "H  "]);
    level[LEVEL_FREEZE_ZONKS] = 2;
    let mut m = started(&level);
    assert_eq!(hold(&mut m, RIGHT, 20) & EV_PUSH, 0);
}

#[test]
fn a_special_port_hands_on_its_settings() {
    let mut level = level(&["M  "]);
    let port = at(1, 0);
    level[port as usize] = SPECIAL_PORT_RIGHT;
    level[1471] = 1;
    level[1472..1474].copy_from_slice(&((port * 2) as u16).to_be_bytes());
    level[1474..1477].copy_from_slice(&[1, 2, 1]);
    let mut m = started(&level);
    let events = hold(&mut m, RIGHT, 20);
    assert_ne!(events & EV_GRAVITY, 0);
    assert!(m.gravity() && m.zonks_frozen() && m.enemies_frozen());
    assert_eq!(m.murphy(), at(2, 0));
}

#[test]
fn murphy_goes_out_through_the_exit_and_the_level_ends() {
    let mut m = started(&level(&["ME"]));
    let events = hold(&mut m, RIGHT, 100);
    assert_ne!(events & EV_WIN, 0);
    assert!(m.completed());
    // Out: the level is over, and frames no longer count down.
    let quit = m.quit_countdown();
    hold(&mut m, RIGHT, 50);
    assert_eq!(m.quit_countdown(), quit);
}

#[test]
fn infotrons_past_the_ones_needed_still_count() {
    let mut level = level(&["M@@E"]);
    level[1470] = 1;
    let mut m = started(&level);
    let events = hold(&mut m, RIGHT, 40);
    assert_ne!(events & EV_EXIT_OPEN, 0);
    assert!(m.completed());
}

#[test]
fn a_zonk_landing_on_murphy_while_he_pushes_sideways_spares_him() {
    let mut m = started(&level(&["O  ", "   ", "MO ", "HHH"]));
    hold(&mut m, RIGHT, 20);
    assert!(!m.killed());
}

#[test]
fn a_zonk_pushed_onto_a_passing_snik_snak_blows_it_up() {
    let mut m = started(&level(&["MO HHH", "HH   S", "HHHHHH"]));
    hold(&mut m, 0, 5);
    hold(&mut m, RIGHT, 30);
    assert_eq!(m.death(), (DEATH_BLAST, at(1, 0)));
}

#[test]
fn a_snik_snak_spares_murphy_while_he_is_in_a_port() {
    let mut m = started(&level(&["SHH", "M> "]));
    hold(&mut m, 0, 20);
    assert_eq!(m.death().0, DEATH_ENEMY);
    let mut m = started(&level(&["SHH", "M> "]));
    hold(&mut m, 0, 15);
    hold(&mut m, RIGHT, 12);
    assert!(!m.killed());
    assert_eq!(m.murphy(), at(2, 1));
}

#[test]
fn a_special_port_missing_from_its_table_changes_nothing() {
    let mut level = level(&["M  "]);
    level[at(1, 0) as usize] = SPECIAL_PORT_RIGHT;
    level[1471] = 1;
    // The table's one entry is for another cell.
    level[1472..1474].copy_from_slice(&((at(5, 5) * 2) as u16).to_be_bytes());
    level[1474] = 1;
    let mut m = started(&level);
    let events = hold(&mut m, RIGHT, 20);
    assert_ne!(events & EV_PORT, 0);
    assert_eq!(events & EV_GRAVITY, 0);
    assert!(!m.gravity());
    assert_eq!(m.murphy(), at(2, 0));
}

#[test]
fn a_special_port_that_leaves_gravity_as_it_is_says_nothing_of_it() {
    let mut level = level(&["M  "]);
    let port = at(1, 0);
    level[port as usize] = SPECIAL_PORT_RIGHT;
    level[1471] = 1;
    level[1472..1474].copy_from_slice(&((port * 2) as u16).to_be_bytes());
    level[1474..1477].copy_from_slice(&[0, 2, 0]);
    let mut m = started(&level);
    let events = hold(&mut m, RIGHT, 20);
    assert_eq!(events & EV_GRAVITY, 0);
    assert!(m.zonks_frozen());
}

#[test]
fn a_bug_says_when_it_starts_sparking() {
    let mut m = started(&level(&["M  ", "   "]));
    m.board.set(at(2, 1), at_rest(BUG));
    let mut events = 0;
    for _ in 0..1000 {
        m.frame(0);
        events |= m.events();
    }
    assert_ne!(events & EV_BUG_SPARK, 0);
}
