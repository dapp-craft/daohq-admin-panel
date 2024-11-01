-- Disable the enforcement of foreign-keys constraints
PRAGMA foreign_keys = off;
-- Create "new_Resource" table
CREATE TABLE `new_Resource` (
  `id` integer NULL,
  `name` varchar NULL,
  `last_usage` integer NULL DEFAULT (strftime('%s', 'now')),
  `file` integer NULL,
  `type` varchar NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `0` FOREIGN KEY (`file`) REFERENCES `Files` (`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- Copy rows from old table "Resource" to new temporary table "new_Resource"
INSERT INTO `new_Resource` (`id`, `name`, `file`, `type`) SELECT `id`, `name`, `file`, `type` FROM `Resource`;
-- Drop "Resource" table after copying rows
DROP TABLE `Resource`;
-- Rename temporary table "new_Resource" to "Resource"
ALTER TABLE `new_Resource` RENAME TO `Resource`;
-- Enable back the enforcement of foreign-keys constraints
PRAGMA foreign_keys = on;
