CREATE TABLE User (
    address VARCHAR(150) UNIQUE PRIMARY KEY,
    role VARCHAR(11)
);

CREATE TABLE Location (
    id VARCHAR(50) UNIQUE NOT NULL,
    type VARCHAR(8),
    preview VARCHAR(300),
    scene VARCHAR(300),
    for_booking BOOLEAN DEFAULT 1
);

CREATE TABLE Booking (
    id INTEGER PRIMARY KEY,
    owner VARCHAR(150),
    title VARCHAR(150),
    creation_date INTEGER,
    start_date INTEGER,
    duration INTEGER,
    event_date INTEGER,
    description VARCHAR(1000),
    preview VARCHAR(300),
    is_live BOOLEAN DEFAULT 0,
    location VARCHAR(50) REFERENCES Location(id)
);

CREATE TABLE Slot (
    id INTEGER UNIQUE NOT NULL,
    name VARCHAR(150),
    supports_streaming BOOLEAN,
    trigger BOOLEAN DEFAULT FALSE,
    format VARCHAR(100) DEFAULT "16:9",
    location VARCHAR(50) REFERENCES Location(id)
);

CREATE TABLE SlotStates (
    booking INTEGER REFERENCES Booking(id),
    slot INTEGER REFERENCES Slot(id),
    content_index INTEGER DEFAULT 0,
    is_paused BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (booking, slot)
);

CREATE TABLE Resource (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100),
    last_usage INTEGER DEFAULT (strftime('%s', 'now')),
    deleted BOOLEAN DEFAULT FALSE,
    last_used INTEGER DEFAULT 0,
    file INTEGER REFERENCES Files(id),
    type VARCHAR(20)
);

CREATE TABLE Files (
    id INTEGER PRIMARY KEY,
    s3_urn VARCHAR(300),
    preview VARCHAR(300),
    user INTEGER REFERENCES User(address)
);

CREATE TABLE DiscordScreen (
    id VARCHAR(500) PRIMARY KEY,
    description VARCHAR(300),
    guild VARCHAR(700),
    channel VARCHAR(700),
    location VARCHAR(50) REFERENCES Location(id)
);

CREATE TABLE Discord (
    message_link VARCHAR(500) UNIQUE,
    added_at INTEGER,
    guild VARCHAR(700),
    channel VARCHAR(700),
    s3_urn VARCHAR(300)
);

CREATE TABLE Metrics (
    id VARCHAR(500) UNIQUE,
    s3_urn VARCHAR(300)
);

CREATE TABLE Content (
    id INTEGER PRIMARY KEY,
    order_id INTEGER,
    booking INTEGER REFERENCES Booking(id),
    slot INTEGER REFERENCES Slot(id),
    resource INTEGER REFERENCES Resource(id)
);

CREATE TABLE Music (
    id INTEGER PRIMARY KEY,
    order_id INTEGER,
    booking INTEGER REFERENCES Booking(id),
    location VARCHAR(50) REFERENCES Location(id),
    resource INTEGER REFERENCES Resource(id)
);
