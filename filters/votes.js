/**
 * votes database table definition
 */

module.exports = function(db) {
	var cols = {
		quoteId : db.int_t,
		vote : db.int_t,
		ip : [db.varchar_t, 15],
		date : db.datetime_t};
	
	db.add_filter('votes', new db('votes', cols, {}));
}
