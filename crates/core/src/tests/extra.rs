//! Recordings in data/extra (an .sp file and, per frame, an FNV-1a hash of
//! the 1440 tiles and states, Murphy's cell and the seed), frame for frame,
//! and death causes for enemies.
//!
//! Where a reference recording parts from the original game (the
//! disassembly), the crate follows the disassembly; those recordings are
//! listed in `PARTS_FROM_ASSEMBLY` with the frame where they part, and must
//! play identically up to that frame and part exactly there.
use crate::{CELLS, LEVEL_BYTES, Machine};

/// Recordings that part from the original game's code, and the first frame
/// where they do. In all three Murphy walks below the field (cell 1536
/// and up). In the original that memory is the explosion timers (the level
/// is 1536 words at DS 1834h, the timers follow at DS 2434h), so Murphy's
/// tile lands in two timers, `sub_4A5E0` counts it down that same frame, he
/// is lost the next frame and `loc_49E99` blows up his last cell (shaking
/// the screen, which draws a random number every frame), and the two timers
/// blow up their cells a frame later. None of those explosions happen in
/// these recordings.
const PARTS_FROM_ASSEMBLY: [(&str, usize); 3] =
    [("wild389.sp", 555), ("wild684.sp", 298), ("wild757.sp", 40)];

/// FNV-1a over one frame, as the recordings hash it.
fn frame_hash(m: &Machine) -> u64 {
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    let mut eat = |b: u8| {
        hash ^= b as u64;
        hash = hash.wrapping_mul(0x0100_0000_01b3);
    };
    for i in 0..CELLS as i32 {
        eat(m.tile(i));
        eat(m.state(i));
    }
    for b in (m.murphy() as u16)
        .to_le_bytes()
        .into_iter()
        .chain(m.seed().to_le_bytes())
    {
        eat(b);
    }
    hash
}

/// Plays one recording; returns the first frame that differs, if any.
fn first_difference(sp: &[u8], frames: &[u8]) -> Option<(usize, String)> {
    let mut level = [0u8; LEVEL_BYTES];
    level.copy_from_slice(&sp[..LEVEL_BYTES]);
    let mut keys = Vec::new();
    for &b in &sp[LEVEL_BYTES + 1..] {
        if b == 0xff {
            break;
        }
        for _ in 0..=(b >> 4) {
            keys.push(b & 0x0f);
        }
    }
    let mut m = Box::new(Machine::new());
    m.start(&level, u16::from_le_bytes([level[1534], level[1535]]));
    for (f, recorded) in frames.as_chunks::<8>().0.iter().enumerate() {
        m.frame(keys.get(f).copied().unwrap_or(0));
        let recorded = u64::from_le_bytes(*recorded);
        if frame_hash(&m) != recorded {
            return Some((f, format!("frame {f}")));
        }
    }
    None
}

#[test]
fn every_extra_recording_is_the_original() {
    let dir = format!("{}/../../data/extra", env!("CARGO_MANIFEST_DIR"));
    let mut names: Vec<_> = std::fs::read_dir(&dir)
        .unwrap()
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| p.extension().is_some_and(|e| e.eq_ignore_ascii_case("sp")))
        .collect();
    names.sort();
    assert!(!names.is_empty(), "no recordings in {dir}");
    let mut failed = Vec::new();
    for sp in &names {
        let frames = std::fs::read(sp.with_extension("frames")).unwrap();
        let name = sp.file_name().unwrap().to_string_lossy().to_string();
        let parts = first_difference(&std::fs::read(sp).unwrap(), &frames);
        match PARTS_FROM_ASSEMBLY.iter().find(|(n, _)| n.eq_ignore_ascii_case(&name)) {
            None => {
                if let Some((_, why)) = parts {
                    failed.push(format!("{}: {why}", sp.display()));
                }
            }
            Some(&(_, expected)) => match parts {
                Some((f, _)) if f == expected => {}
                other => failed.push(format!(
                    "{}: should play as recorded up to frame {expected} and part from the recording there \
                     (below the field the original's memory is the explosion timers, which these \
                     recordings do not show), but {}",
                    sp.display(),
                    match other {
                        Some((_, why)) => format!("parts at {why}"),
                        None => "it plays as recorded to the end".to_string(),
                    }
                )),
            },
        }
    }
    assert!(
        failed.is_empty(),
        "recordings that part from the original:\n{}",
        failed.join("\n")
    );
}

/// A level of hardware with a corridor in row 5 from column 5 to 30, an
/// enemy in its second cell.
fn corridor(enemy: u8) -> [u8; LEVEL_BYTES] {
    let mut level = [0u8; LEVEL_BYTES];
    level[..CELLS].fill(6);
    for x in 5..=30 {
        level[5 * 60 + x] = 0;
    }
    level[5 * 60 + 5] = 3;
    level[5 * 60 + 6] = enemy;
    level
}

/// An enemy goes right along a short corridor; Murphy waits below its
/// second cell and steps up into it while the enemy is moving out of it:
/// the cause is the enemy.
#[test]
fn walking_into_a_cell_an_enemy_is_leaving_is_death_by_enemy() {
    for enemy in [0x11u8, 0x18] {
        let mut level = [0u8; LEVEL_BYTES];
        level[..CELLS].fill(6);
        for x in 6..=9 {
            level[6 * 60 + x] = 0;
        }
        level[6 * 60 + 5] = enemy;
        let below: i32 = 7 * 60 + 6;
        level[below as usize] = 3;
        let mut m = Box::new(Machine::new());
        m.start(&level, 0);
        let mut stepped = false;
        for _ in 0..200 {
            let leaving = m.tile(below - 60) == 0xbb;
            stepped |= leaving;
            m.frame(if leaving { 1 } else { 0 });
            if m.killed() {
                break;
            }
        }
        assert!(
            stepped,
            "enemy {enemy:#x}: it never left the cell above Murphy"
        );
        assert!(m.killed(), "enemy {enemy:#x}");
        assert_eq!(m.death(), (2, below), "enemy {enemy:#x}");
    }
}

/// An enemy that turns back and comes at Murphy, who stands still, catches
/// him: the cause is the enemy.
#[test]
fn caught_by_an_enemy_is_death_by_enemy() {
    for enemy in [0x11u8, 0x18] {
        let mut level = corridor(enemy);
        // Murphy at the far end, waiting.
        level[5 * 60 + 5] = 0;
        level[5 * 60 + 30] = 3;
        let mut m = Box::new(Machine::new());
        m.start(&level, 0);
        for _ in 0..2000 {
            m.frame(0);
            if m.killed() {
                break;
            }
        }
        assert!(m.killed(), "enemy {enemy:#x}");
        assert_eq!(m.death().0, 2, "enemy {enemy:#x}");
    }
}
