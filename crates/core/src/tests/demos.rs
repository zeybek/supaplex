//! The ten demos, frame for frame against the original's recorded
//! behaviour, and the two that are solutions finishing their level.
use crate::{CELLS, LEVEL_BYTES, Machine};

fn demo(n: usize) -> Vec<u8> {
    std::fs::read(format!(
        "{}/../../data/DEMO{n}.BIN",
        env!("CARGO_MANIFEST_DIR")
    ))
    .unwrap()
}

/// A demo's keys, one per frame.
fn keys(file: &[u8]) -> Vec<u8> {
    let mut out = Vec::new();
    for &byte in &file[LEVEL_BYTES + 1..] {
        if byte == 0xff {
            break;
        }
        for _ in 0..=(byte >> 4) {
            out.push(byte & 0x0f);
        }
    }
    out
}

fn level(file: &[u8]) -> [u8; LEVEL_BYTES] {
    let mut level = [0u8; LEVEL_BYTES];
    level.copy_from_slice(&file[..LEVEL_BYTES]);
    level
}

/// (frames the original ran, FNV-1a over every frame's 1440 tiles and
/// states, Murphy's cell and the seed, each u16 little endian).
const ORIGINAL: [(usize, u64); 10] = [
    (819, 0x5c33_7c95_896f_e6a3),
    (89, 0x433d_2b01_97e7_3087),
    (203, 0xe4da_6076_3c05_2664),
    (222, 0x84bf_1b15_ffc7_8a60),
    (136, 0x2e6a_da31_a146_75ea),
    (5787, 0x0c26_cc59_f05c_4c2f),
    (4424, 0xe534_8d34_b13e_7799),
    (5987, 0xdad7_2012_4bf9_72fb),
    (5222, 0x646a_05b1_24af_cfae),
    (353, 0x2d59_1a70_1c21_20f9),
];

#[test]
fn every_frame_of_the_ten_demos_is_the_original() {
    let mut failed = Vec::new();
    for (n, &(frames, expected)) in ORIGINAL.iter().enumerate() {
        let file = demo(n);
        let level = level(&file);
        let keys = keys(&file);
        let mut m = Box::new(Machine::new());
        m.start(&level, u16::from_le_bytes([level[1534], level[1535]]));
        let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
        let mut eat = |b: u8| {
            hash ^= b as u64;
            hash = hash.wrapping_mul(0x0100_0000_01b3);
        };
        for f in 0..frames {
            m.frame(keys.get(f).copied().unwrap_or(0));
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
        }
        if hash != expected {
            failed.push(n);
        }
    }
    assert!(
        failed.is_empty(),
        "demos that part from the original: {failed:?}"
    );
}

#[test]
fn the_two_solution_demos_win() {
    for n in [5, 7] {
        let file = demo(n);
        let level = level(&file);
        let mut m = Box::new(Machine::new());
        m.start(&level, u16::from_le_bytes([level[1534], level[1535]]));
        let mut won = false;
        for key in keys(&file) {
            m.frame(key);
            won |= m.events() & 32 != 0;
            if m.completed() {
                break;
            }
        }
        assert!(won && m.completed(), "DEMO{n} wins");
        assert_eq!(m.infotrons_left(), 0);
    }
}
