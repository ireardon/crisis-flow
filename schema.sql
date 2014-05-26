-- SQLite has no support for enum types, so I'm buldin' my own
CREATE TABLE role (
	id INTEGER PRIMARY KEY,
	name TEXT
);

INSERT INTO role(name) VALUES('admin');
INSERT INTO role(name) VALUES('producer');
INSERT INTO role(name) VALUES('consumer');

CREATE TABLE users (
	username TEXT PRIMARY KEY,
	password_hash TEXT,
	role INT,
	FOREIGN KEY(role) REFERENCES role(id)
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
