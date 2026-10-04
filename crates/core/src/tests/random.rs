//! Random keys and random levels, for the tests that play long games:
//! `play.rs` here and the WebAssembly crate's tests.

/// The size of a level, and of its field.
pub const LEVEL_BYTES: usize = 1536;
pub const CELLS: usize = 1440;

/// A small generator of keys: each held for a while, as a player holds them.
pub struct Keys {
    pub state: u32,
    key: u8,
    pub left: u32,
}

impl Keys {
    pub fn new(seed: u32) -> Keys {
        Keys {
            state: seed | 1,
            key: 0,
            left: 0,
        }
    }

    pub fn next(&mut self) -> u8 {
        if self.left == 0 {
            // xorshift32
            self.state ^= self.state << 13;
            self.state ^= self.state >> 17;
            self.state ^= self.state << 5;
            self.key = (self.state % 10) as u8;
            self.left = 1 + (self.state >> 8) % 48;
        }
        self.left -= 1;
        self.key
    }
}

/// A random level: every piece the file format has, packed close so they
/// meet, a random seed, gravity and frozen Zonks, and special ports in its
/// table.
pub fn random_level(keys: &mut Keys) -> [u8; LEVEL_BYTES] {
    let mut level = [0u8; LEVEL_BYTES];
    let mut roll = |n: u32| {
        keys.left = 0;
        keys.next();
        keys.state % n
    };
    // Mostly room to move, some of everything.
    for cell in level.iter_mut().take(CELLS) {
        *cell = match roll(10) {
            0..=3 => 0,
            4 => 2,
            _ => roll(41) as u8,
        };
    }
    // One Murphy, somewhere.
    level[roll(CELLS as u32) as usize] = 3;
    level[1444] = roll(2) as u8;
    level[1469] = if roll(3) == 0 { 2 } else { 0 };
    level[1470] = roll(4) as u8;
    let mut ports = 0;
    for cell in 0..CELLS {
        if (13..=16).contains(&level[cell]) && ports < 10 {
            let at = 1472 + ports * 6;
            let address = (cell * 2) as u16;
            level[at..at + 2].copy_from_slice(&address.to_be_bytes());
            level[at + 2] = roll(2) as u8;
            level[at + 3] = if roll(2) == 0 { 2 } else { 0 };
            level[at + 4] = roll(2) as u8;
            ports += 1;
        }
    }
    level[1471] = ports as u8;
    level[1534] = roll(256) as u8;
    level[1535] = roll(256) as u8;
    level
}
