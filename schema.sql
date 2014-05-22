-- SQLite has no support for enum types, so I'm buldin' my own
CREATE TABLE utype (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT
);

INSERT INTO utype VALUES('admin');
INSERT INTO utype VALUES('producer');
INSERT INTO utype VALUES('consumer');

CREATE TABLE users (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	email TEXT,
	password_hash TEXT,
	utype FOREIGN KEY(utype) REFERENCES utype(id)
);

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
