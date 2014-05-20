CREATE TABLE rooms (
	id TEXT PRIMARY KEY,
	name TEXT
);

CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room TEXT,
    nickname TEXT,
    body TEXT,
    time INTEGER,
	FOREIGN KEY(room) REFERENCES rooms(id)
);
