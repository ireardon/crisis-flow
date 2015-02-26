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
	display_name TEXT,
	FOREIGN KEY(role) REFERENCES role(id)
);

CREATE TABLE rooms (
	id INTEGER PRIMARY KEY,
	name TEXT
);

CREATE TABLE channels (
	id INTEGER PRIMARY KEY,
	room INTEGER,
	name TEXT,
	color_index INTEGER, -- channels are room-specific, so we cannot simply use the id
	FOREIGN KEY(room) REFERENCES rooms(id) ON DELETE CASCADE
);

CREATE TABLE messages (
    id INTEGER PRIMARY KEY,
    room INTEGER,
    author TEXT,
	channel INTEGER,
	reply INTEGER, -- to indicate that this is a top-level message, we use a negative number
    content TEXT,
    time INTEGER,
	FOREIGN KEY(room) REFERENCES rooms(id) ON DELETE CASCADE,
	FOREIGN KEY(author) REFERENCES users(username),
	FOREIGN KEY(channel) REFERENCES channels(id),
	FOREIGN KEY(reply) REFERENCES messages(id)
);

CREATE TABLE tasks (
	id INTEGER PRIMARY KEY,
	room INTEGER,
	author TEXT,
	title TEXT,
	status INTEGER,
	high_priority BOOLEAN,
	content TEXT,
	time INTEGER,
	FOREIGN KEY(room) REFERENCES rooms(id) ON DELETE CASCADE,
	FOREIGN KEY(author) REFERENCES users(username)
);

CREATE TABLE tags (
	id INTEGER PRIMARY KEY,
	name TEXT
);

CREATE TABLE task_tags (
	id INTEGER PRIMARY KEY,
	task INTEGER,
	tag INTEGER,
	FOREIGN KEY(task) REFERENCES tasks(id) ON DELETE CASCADE,
	FOREIGN KEY(tag) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE TABLE attachments (
	id INTEGER PRIMARY KEY,
	user_filename TEXT,
	internal_filename TEXT
);

CREATE TABLE task_attachments (
	id INTEGER PRIMARY KEY,
	task INTEGER,
	attachment INTEGER,
	FOREIGN KEY(task) REFERENCES tasks(id) ON DELETE CASCADE,
	FOREIGN KEY(attachment) REFERENCES attachments(id) ON DELETE CASCADE
);

-- an empty line at the end of the file is necessary!
