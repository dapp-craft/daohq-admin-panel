-- Disable the enforcement of foreign-keys constraints
PRAGMA foreign_keys = off;
-- Create "new_Slot" table
CREATE TABLE `new_Slot` (
  `id` integer NOT NULL,
  `name` varchar NULL,
  `supports_streaming` boolean NULL,
  `format` varchar NULL DEFAULT '16:9',
  `location` varchar NULL,
  CONSTRAINT `0` FOREIGN KEY (`location`) REFERENCES `Location` (`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- Copy rows from old table "Slot" to new temporary table "new_Slot"
INSERT INTO `new_Slot` (`id`, `name`, `supports_streaming`, `location`) SELECT `id`, `name`, `supports_streaming`, `location` FROM `Slot`;
-- Drop "Slot" table after copying rows
DROP TABLE `Slot`;
-- Rename temporary table "new_Slot" to "Slot"
ALTER TABLE `new_Slot` RENAME TO `Slot`;
-- Create index "Slot_id" to table: "Slot"
CREATE UNIQUE INDEX `Slot_id` ON `Slot` (`id`);
-- Enable back the enforcement of foreign-keys constraints
PRAGMA foreign_keys = on;
