"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyRefreshToken = exports.generateRefreshToken = exports.generateAccessToken = exports.comparePassword = exports.hashPassword = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const hashPassword = async (password) => {
    const saltRounds = 12;
    return bcrypt_1.default.hash(password, saltRounds);
};
exports.hashPassword = hashPassword;
const comparePassword = async (password, hashedPassword) => {
    return bcrypt_1.default.compare(password, hashedPassword);
};
exports.comparePassword = comparePassword;
const generateAccessToken = (payload) => {
    return jsonwebtoken_1.default.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });
};
exports.generateAccessToken = generateAccessToken;
const generateRefreshToken = (payload) => {
    return jsonwebtoken_1.default.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
};
exports.generateRefreshToken = generateRefreshToken;
const verifyRefreshToken = (token) => {
    return jsonwebtoken_1.default.verify(token, process.env.JWT_REFRESH_SECRET);
};
exports.verifyRefreshToken = verifyRefreshToken;
