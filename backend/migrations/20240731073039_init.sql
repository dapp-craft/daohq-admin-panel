-- Create "User" table
CREATE TABLE `User` (
  `address` varchar NULL,
  `role` varchar NULL,
  PRIMARY KEY (`address`)
);
-- Create "Location" table
CREATE TABLE `Location` (
  `id` varchar NOT NULL,
  `type` varchar NULL,
  `preview` varchar NULL,
  `scene` varchar NULL,
  `for_booking` boolean NULL DEFAULT 1
);
-- Create index "Location_id" to table: "Location"
CREATE UNIQUE INDEX `Location_id` ON `Location` (`id`);
-- Create "Booking" table
CREATE TABLE `Booking` (
  `id` integer NULL,
  `owner` varchar NULL,
  `title` varchar NULL,
  `creation_date` integer NULL,
  `start_date` integer NULL,
  `duration` integer NULL,
  `event_date` integer NULL,
  `description` varchar NULL,
  `preview` varchar NULL,
  `is_live` boolean NULL DEFAULT 0,
  `location` varchar NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `0` FOREIGN KEY (`location`) REFERENCES `Location` (`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- Create "Slot" table
CREATE TABLE `Slot` (
  `id` integer NOT NULL,
  `name` varchar NULL,
  `supports_streaming` boolean NULL,
  `location` varchar NULL,
  CONSTRAINT `0` FOREIGN KEY (`location`) REFERENCES `Location` (`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- Create index "Slot_id" to table: "Slot"
CREATE UNIQUE INDEX `Slot_id` ON `Slot` (`id`);
-- Create "SlotStates" table
CREATE TABLE `SlotStates` (
  `booking` integer NULL,
  `slot` integer NULL,
  `content_index` integer NULL DEFAULT 0,
  `is_paused` boolean NULL DEFAULT FALSE,
  PRIMARY KEY (`booking`, `slot`),
  CONSTRAINT `0` FOREIGN KEY (`slot`) REFERENCES `Slot` (`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT `1` FOREIGN KEY (`booking`) REFERENCES `Booking` (`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- Create "Resource" table
CREATE TABLE `Resource` (
  `id` integer NULL,
  `name` varchar NULL,
  `file` integer NULL,
  `type` varchar NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `0` FOREIGN KEY (`file`) REFERENCES `Files` (`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- Create "Files" table
CREATE TABLE `Files` (
  `id` integer NULL,
  `s3_urn` varchar NULL,
  `preview` varchar NULL,
  `user` integer NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `0` FOREIGN KEY (`user`) REFERENCES `User` (`address`) ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- Create "DiscordScreen" table
CREATE TABLE `DiscordScreen` (
  `id` varchar NULL,
  `description` varchar NULL,
  `guild` varchar NULL,
  `channel` varchar NULL,
  `location` varchar NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `0` FOREIGN KEY (`location`) REFERENCES `Location` (`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- Create "Discord" table
CREATE TABLE `Discord` (
  `message_link` varchar NULL,
  `added_at` integer NULL,
  `guild` varchar NULL,
  `channel` varchar NULL,
  `s3_urn` varchar NULL
);
-- Create index "Discord_message_link" to table: "Discord"
CREATE UNIQUE INDEX `Discord_message_link` ON `Discord` (`message_link`);
-- Create "Metrics" table
CREATE TABLE `Metrics` (
  `id` varchar NULL,
  `s3_urn` varchar NULL
);
-- Create index "Metrics_id" to table: "Metrics"
CREATE UNIQUE INDEX `Metrics_id` ON `Metrics` (`id`);
-- Create "Content" table
CREATE TABLE `Content` (
  `id` integer NULL,
  `order_id` integer NULL,
  `booking` integer NULL,
  `slot` integer NULL,
  `resource` integer NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `0` FOREIGN KEY (`resource`) REFERENCES `Resource` (`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT `1` FOREIGN KEY (`slot`) REFERENCES `Slot` (`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT `2` FOREIGN KEY (`booking`) REFERENCES `Booking` (`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- Create "Music" table
CREATE TABLE `Music` (
  `id` integer NULL,
  `order_id` integer NULL,
  `booking` integer NULL,
  `location` varchar NULL,
  `resource` integer NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `0` FOREIGN KEY (`resource`) REFERENCES `Resource` (`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT `1` FOREIGN KEY (`location`) REFERENCES `Location` (`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT `2` FOREIGN KEY (`booking`) REFERENCES `Booking` (`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);
