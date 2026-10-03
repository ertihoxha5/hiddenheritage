CREATE DATABASE IF NOT EXISTS hidden_heritage CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE hidden_heritage;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('tourist','teacher','guide') NOT NULL DEFAULT 'tourist',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX (token_hash)
);

CREATE TABLE IF NOT EXISTS monuments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(150) NOT NULL UNIQUE,
  name_en VARCHAR(255) NOT NULL,
  name_sq VARCHAR(255) NOT NULL,
  type ENUM('castle','church','mosque','monument','bridge','archaeological','tower') NOT NULL,
  municipality VARCHAR(150) NOT NULL,
  lat DECIMAL(9,6) NOT NULL,
  lng DECIMAL(9,6) NOT NULL,
  built_period VARCHAR(255),
  short_description VARCHAR(1000),
  history TEXT,
  image_now VARCHAR(500),
  image_now_credit VARCHAR(1000),
  image_then VARCHAR(500),
  sources JSON
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(254) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
