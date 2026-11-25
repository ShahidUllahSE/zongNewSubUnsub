-- ======================================================================
-- Zong Reverse Flow Service Database Schema
-- Table Name: subscribers_new_requirement
-- Table Name: reverse_flow_logs_new_requirement
-- ======================================================================

-- 1. Create Subscribers Table (subscribers_new_requirement)
CREATE TABLE IF NOT EXISTS `subscribers_new_requirement` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `msisdn` VARCHAR(20) NOT NULL,
  `service_id` VARCHAR(20) NOT NULL DEFAULT '1',
  `channel_id` VARCHAR(20) NOT NULL COMMENT '18=CRM, 19=MZA',
  `bundle_id` VARCHAR(50) NULL COMMENT 'Promo / Bundle ID (e.g. 95006464)',
  `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'INACTIVE',
  `subscribed_at` DATETIME(3) NULL,
  `unsubscribed_at` DATETIME(3) NULL,
  `last_zong_timestamp` VARCHAR(20) NULL COMMENT 'yyyymmddhhmmss from Zong',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_subscribers_msisdn` (`msisdn`),
  KEY `idx_subscribers_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Create Audit & Transaction Logs Table (reverse_flow_logs_new_requirement)
CREATE TABLE IF NOT EXISTS `reverse_flow_logs_new_requirement` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `msisdn` VARCHAR(20) NULL,
  `service_id` VARCHAR(20) NULL,
  `channel_id` VARCHAR(20) NULL,
  `channel_option` VARCHAR(10) NULL COMMENT '1=Sub, 2=Unsub',
  `bundle_id` VARCHAR(50) NULL,
  `zong_timestamp` VARCHAR(20) NULL,
  `raw_request` TEXT NOT NULL COMMENT 'Full incoming SOAP XML',
  `raw_response` TEXT NOT NULL COMMENT 'Full outgoing SOAP XML response',
  `response_code` INT NOT NULL COMMENT '0=Success, 2=Already Sub, 3=Already Unsub, etc.',
  `response_description` VARCHAR(255) NOT NULL,
  `client_ip` VARCHAR(50) NULL,
  `execution_time_ms` INT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_reverse_flow_logs_msisdn` (`msisdn`),
  KEY `idx_reverse_flow_logs_code` (`response_code`),
  KEY `idx_reverse_flow_logs_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
