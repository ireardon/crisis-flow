-- SQLite has no support for enum types, so I'm buldin' my own
CREATE TABLE utype (
	id INTEGER PRIMARY KEY,
	name TEXT
);

INSERT INTO utype(name) VALUES('admin');
INSERT INTO utype(name) VALUES('producer');
INSERT INTO utype(name) VALUES('consumer');

CREATE TABLE users (
	id INTEGER PRIMARY KEY,
	username TEXT,
	password_hash TEXT,
	utype INT,
	FOREIGN KEY(utype) REFERENCES utype(id)
);

CREATE TABLE rooms (
	id TEXT PRIMARY KEY,
	name TEXT
);

CREATE TABLE messages (
    id INTEGER PRIMARY KEY,
    room TEXT,
    nickname TEXT,
    body TEXT,
    time INTEGER,
	FOREIGN KEY(room) REFERENCES rooms(id)
);
