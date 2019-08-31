/**
 * quotes table definition for db-filters
 */

module.exports = function reg(db) {
	var cols = {
		id : db.int_t,
		date : db.datetime_t,
		ip : [db.varchar_t, 15],
		score : db.int_t,
		flags : db.int_t,
		quote : db.text_t};

	db.add_filter('quotes', new db('quotes', cols, {}));
};
