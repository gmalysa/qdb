/**
 * Router that handles the index route.
 */

var admin = require('../admin');

/**
 * Render the index page template, which is pretty much static
 * @param env The request environment
 * @param after The next callback in the chain
 */
function index(env, after) {
	env.$template('index');
	env.$output({title : 'Home'});
	env.$output({news : [
		{
		title : 'SWC Down',
		date : 'Fri Jan 10, 2014 2:31',
		author : 'selatos',
		news : 'SWC may be down for now, but QDB remains online.'
		}],
		admin : admin.isAdmin(env)});
	after();
}

function disclaimer(env, after) {
	env.$template('disclaimer');
	env.$output({title : 'Disclaimer',
					admin : admin.isAdmin(env)});
	after();
}

// Export mandatory routing module interface
module.exports.init_routes = function(server) {
	server.add_route('/', {fn : index, pre : ['default', 'admin'], post : ['default', 'pending']}, 'get');
	server.add_route('/disclaimer', {fn : disclaimer, pre : ['default', 'admin'], post : ['default', 'pending']}, 'get');
};
