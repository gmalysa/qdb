/**
 * admin table definition for db-filters
 */

module.exports = function reg(db) {
	var cols = {
		id : db.int_t,
		name : [db.varchar_t, 32],
		salt : [db.varchar_t, 8],
		password : [db.varchar_t, 32]
	};
	var special = {
		salt_pass : function(key, value, terms, options) {
			var nvalue = db.$eq(db.$md5(db.$concat(this.c.salt, value)));
			terms.push(nvalue.get('password', this, options));
		}
	};

	db.add_filter('admin', new db('admin', cols, special));
};
