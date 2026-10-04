//! The crate's surface at its edges: cells off the field, keys the game
//! has no use for, settings changed from outside.
use crate::{CELLS, LEVEL_BYTES, Machine};

const LEVELS: &[u8] = include_bytes!("../../../../data/LEVELS.DAT");

fn level_one() -> Box<Machine> {
    let mut m = Box::<Machine>::default();
    m.start(LEVELS[..LEVEL_BYTES].try_into().unwrap(), 1);
    m
}

#[test]
fn cells_off_the_field_read_as_empty() {
    let m = level_one();
    for cell in [-1, CELLS as i32, i32::MIN, i32::MAX] {
        assert_eq!(m.tile(cell), 0);
        assert_eq!(m.state(cell), 0);
    }
    assert_eq!(m.timer(CELLS), 0);
    assert_eq!(m.timer(usize::MAX), 0);
}

#[test]
fn keys_past_space_alone_do_nothing() {
    let mut a = level_one();
    let mut b = level_one();
    for key in 10..16 {
        a.frame(key);
        b.frame(0);
        assert_eq!(a.murphy(), b.murphy(), "key {key}");
        assert_eq!(a.seed(), b.seed());
    }
}

#[test]
fn settings_changed_from_outside_hold() {
    let mut m = level_one();
    assert!(!m.gravity() && !m.enemies_frozen());
    m.set_gravity(true);
    m.set_enemies_frozen(true);
    assert!(m.gravity() && m.enemies_frozen());
}

#[test]
fn a_clone_is_a_save_state_that_plays_on_the_same() {
    let mut game = level_one();
    for _ in 0..200 {
        game.frame(4);
    }
    let mut saved = game.clone();
    for key in [1, 2, 3, 4, 0, 9].iter().cycle().take(600) {
        game.frame(*key);
        saved.frame(*key);
        assert_eq!(game.seed(), saved.seed());
        assert_eq!(game.murphy(), saved.murphy());
        assert_eq!(game.events(), saved.events());
    }
    for c in 0..CELLS as i32 {
        assert_eq!(
            (game.tile(c), game.state(c)),
            (saved.tile(c), saved.state(c))
        );
    }
}
