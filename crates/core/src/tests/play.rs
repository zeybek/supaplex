//! Long random play on every level: the rules never panic, read and write
//! nothing outside their memory, and play the same game twice from the
//! same keys and seed.
use super::random::{Keys, random_level};
use crate::{CELLS, LEVEL_BYTES, Machine};

const LEVELS: &[u8] = include_bytes!("../../../../data/LEVELS.DAT");

/// Everything the crate says about a frame, folded into one number; the
/// whole field only on every 64th frame, which is plenty to tell two games
/// apart and keeps the test quick.
fn fold(hash: &mut u64, m: &Machine, frame: usize) {
    let mut add = |value: u64| {
        *hash ^= value;
        *hash = hash.wrapping_mul(0x100_0000_01b3);
    };
    if frame.is_multiple_of(64) {
        for c in 0..CELLS as i32 {
            add(u64::from(m.tile(c)) << 8 | u64::from(m.state(c)));
            add(m.timer(c as usize) as u8 as u64);
        }
    }
    let (planted, at) = m.planted();
    let (frame, frames) = m.animation();
    let (cause, cell) = m.death();
    for value in [
        m.murphy() as u64,
        u64::from(m.seed()),
        u64::from(m.infotrons_left()),
        u64::from(m.infotrons_needed()),
        u64::from(m.red_disks()),
        u64::from(m.gravity()),
        u64::from(m.zonks_frozen()),
        u64::from(m.enemies_frozen()),
        u64::from(planted),
        at as u64,
        u64::from(m.push_counter()),
        u64::from(frame),
        u64::from(frames),
        u64::from(m.facing()),
        u64::from(m.quit_countdown()),
        u64::from(m.completed()),
        u64::from(m.killed()),
        u64::from(cause),
        cell as u64,
        u64::from(m.events()),
    ] {
        add(value);
    }
}

/// Play every level for `frames` frames on keys from `seed`.
fn play(seed: u32, frames: usize) -> u64 {
    let mut hash = 0xcbf2_9ce4_8422_2325;
    let mut m = Box::new(Machine::new());
    for (n, level) in LEVELS.as_chunks::<LEVEL_BYTES>().0.iter().enumerate() {
        let mut keys = Keys::new(seed ^ n as u32);
        m.start(level, (seed as u16) ^ n as u16);
        for frame in 0..frames {
            m.frame(keys.next());
            fold(&mut hash, &m, frame);
            // A level that ended starts again, as a player would.
            if m.quit_countdown() == 1 {
                m.start(level, keys.next().into());
            }
        }
    }
    hash
}

/// Play `count` random levels for `frames` frames each.
fn play_random(seed: u32, count: usize, frames: usize) -> u64 {
    let mut hash = 0xcbf2_9ce4_8422_2325;
    let mut m = Box::new(Machine::new());
    let mut keys = Keys::new(seed);
    for _ in 0..count {
        let level = random_level(&mut keys);
        m.start(&level, u16::from_le_bytes([level[1534], level[1535]]));
        m.set_enemies_frozen(keys.next() == 0);
        for frame in 0..frames {
            m.frame(keys.next());
            fold(&mut hash, &m, frame);
        }
    }
    hash
}

#[test]
fn random_play_on_every_level_is_the_same_game_twice() {
    assert_eq!(play(0x5eed, 2000), play(0x5eed, 2000));
}

#[test]
fn random_play_on_random_levels_is_the_same_game_twice() {
    assert_eq!(play_random(0xface, 400, 600), play_random(0xface, 400, 600));
}
