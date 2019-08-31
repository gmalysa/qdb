/**
 * bans table definition for db-filters
 */

module.exports = function reg(db) {
	var cols = {
		adminId : db.int_t,
		ip : [db.varchar_t, 15],
		reason : db.text_t,
		date : db.date_t};

	db.add_filter('bans', new db('bans', cols, {}));
};
