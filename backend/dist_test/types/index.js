"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InquirySource = exports.EmployeeRole = exports.ActivityType = exports.PropertyType = exports.ConfidenceLevel = exports.SellerStatus = void 0;
// Enums
var SellerStatus;
(function (SellerStatus) {
    SellerStatus["FOLLOWING_UP"] = "following_up";
    SellerStatus["APPOINTMENT_SCHEDULED"] = "appointment_scheduled";
    SellerStatus["VISITED"] = "visited";
    SellerStatus["EXCLUSIVE_CONTRACT"] = "exclusive_contract";
    SellerStatus["GENERAL_CONTRACT"] = "general_contract";
    SellerStatus["CONTRACTED"] = "contracted";
    SellerStatus["OTHER_DECISION"] = "other_decision";
    SellerStatus["FOLLOW_UP_NOT_NEEDED"] = "follow_up_not_needed";
    SellerStatus["LOST"] = "lost";
})(SellerStatus || (exports.SellerStatus = SellerStatus = {}));
var ConfidenceLevel;
(function (ConfidenceLevel) {
    ConfidenceLevel["A"] = "A";
    ConfidenceLevel["B"] = "B";
    ConfidenceLevel["B_PRIME"] = "B_PRIME";
    ConfidenceLevel["C"] = "C";
    ConfidenceLevel["D"] = "D";
    ConfidenceLevel["E"] = "E";
    ConfidenceLevel["DUPLICATE"] = "DUPLICATE";
})(ConfidenceLevel || (exports.ConfidenceLevel = ConfidenceLevel = {}));
var PropertyType;
(function (PropertyType) {
    PropertyType["DETACHED_HOUSE"] = "detached_house";
    PropertyType["APARTMENT"] = "apartment";
    PropertyType["LAND"] = "land";
    PropertyType["COMMERCIAL"] = "commercial";
})(PropertyType || (exports.PropertyType = PropertyType = {}));
var ActivityType;
(function (ActivityType) {
    ActivityType["PHONE_CALL"] = "phone_call";
    ActivityType["EMAIL"] = "email";
    ActivityType["SMS"] = "sms";
    ActivityType["HEARING"] = "hearing";
    ActivityType["APPOINTMENT"] = "appointment";
})(ActivityType || (exports.ActivityType = ActivityType = {}));
var EmployeeRole;
(function (EmployeeRole) {
    EmployeeRole["ADMIN"] = "admin";
    EmployeeRole["AGENT"] = "agent";
    EmployeeRole["VIEWER"] = "viewer";
})(EmployeeRole || (exports.EmployeeRole = EmployeeRole = {}));
var InquirySource;
(function (InquirySource) {
    InquirySource["IEUL"] = "\u30A6";
    InquirySource["LIFULL"] = "L";
    // Add more as needed
})(InquirySource || (exports.InquirySource = InquirySource = {}));
