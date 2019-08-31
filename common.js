/**
 * Common preparation and processing file. This handles things that would probably
 * otherwise be copied and pasted into place for each server that is made for each
 * new project.
 */

var mod_name = 'Common';
var mod_version = '0.4.3';

// Load all of our core requirements
require('colors');
var _ = require('underscore');
var express = require('express');
var dust = require('dustjs-linkedin');
require('dustjs-helpers');
var fs = require('fs');
var fl = require('flux-link');

// Load other common modules that we will handle
var logger = require('./logger');

/**
 * Default options for express and other configuration, to reduce the need
 * to specify it all in the options array
 */
var default_opts = {
	'set'				: {'env' : 'development'},
	'enable'			: ['trust proxy'],
	'static_mount'		: '/static',
	'static_path'		: 'static',
	'route_dir'			: 'routes',
	'template_dir'		: 'templates',
	'client_path'		: '/ui.js',
	'client_prefix'		: 'c-',
	'dustjs_version'	: '1.2.2',
	'port'				: 8124,
	'shutdown'			: [],
	'base_url'			: '/',
	'session_secret'	: 'thisisasecret'
};

/**
 * Initialization routine takes an express server instance and a list of options
 * and then configures things
 */
function init(server, options) {
	var that = this;
	options = options || {};
	this.options = _.extend({}, default_opts, options);
	this.server = server;

	// Initialize hook chains
	this.pre_hooks = {};
	this.post_hooks = {};
	var hook = new fl.Chain();
	hook.name = 'default';
	this.pre_hooks.default = hook;
	hook = new fl.Chain();
	hook.name = 'default';
	this.post_hooks.default = hook;

	// Load settings into express
	_.each(this.options.set, function(v, k) {
		server.set(v, k);
	});
	_.each(this.options.enable, function(v, k) {
		server.enable(v);
	});

	// Add current time as early as possible in requests
	server.use(function(req, res, next) {
		res.start = process.hrtime();
		next();
	});

	// Configure express middleware
	server.use(express.bodyParser());
	server.use(express.cookieParser());
	server.use(express.session({secret : this.options.session_secret}));
	server.use(this.options.static_mount, express.static(this.options.static_path));
	server.use(server.router);
	server.use(handle_server_error);

	// dustjs-linkedin template and routing configuration
	server.get('/dustjs-core.js', static_serve('node_modules/dustjs-linkedin/dist/dust-core-'+this.options.dustjs_version+'.js'));
	this.load_dust_templates(this.options.template_dir, this.options.client_prefix);
	server.get(this.options.client_path, function(req, res) {
		res.setHeader('Content-Type: text/javascript');
		res.send(that.client_templates);
	});

	// Add common/default filters and helpers to dust
	this.add_default_dust_filters();
	this.add_default_dust_helpers();

	// Load routes from the file system
	this.load_routes(this.options.route_dir);

	// Add shutdown method as our SIGINT handler
	process.on('SIGINT', this.shutdown.bind(this));

	// Finally, listen for express connections
	server.listen(options.port);
	logger.module_init(mod_name, mod_version, 'Express server listening on port '+options.port);
}

/**
 * Load all of the dust templates from a given directory, storing them either in the string of
 * client template information, or by passing them directly to the dust engine
 * @param path String path on the file system for the template directory
 * @param prefix String prefix on file names that correspond to client templates
 * @param prepend String to prepend to template names during instantiation (for directory hierarchy)
 */
function load_dust_templates(path, prefix, prepend) {
	var prefix_len = prefix.length;
	prepend = prepend || '';

	var files = fs.readdirSync(path);
	var that = this;
	this.client_templates = '';

	_.each(files, function(v) {
		// Skip temporary/swap files (helps for running the server while editing)
		if (v[0] == '.')
			return;
	
		fs.stat(path+'/'+v, function(err, stats) {
			if (stats.isDirectory()) {
				that.load_dust_templates(path+'/'+v, prefix, prepend+v+'_');
			}
			else {
				var contents = fs.readFileSync(path+'/'+v, 'utf8');
			
				// Save client templates specially to serve them
				if (v.substr(0, prefix_len) == prefix) {
					logger.info('Loading dust client template '+(prepend+v).cyan+'...', mod_name);
					that.client_templates += dust.compile(contents, prepend+v.substr(prefix_len, v.length));
				}
				else {
					// Server templates should be put into our dust engine though
					logger.info('Loading dust template '+(prepend+v).green+'...', mod_name);
					dust.loadSource(dust.compile(contents, prepend+v));
				}
			}
		});
	});

}

/**
 * Adds all of our default dust filters to the dust object
 */
function add_default_dust_filters() {
	this.add_dust_filters({
		nl : function(value) { return value.replace(/\n/g, '<br />');}
	});
}

/**
 * Adds all of the necessary filters to the dust object
 * @param filters Object of user defined filters, keys are the names and values are functions
 */
function add_dust_filters(filters) {
	_.each(filters, function(v, k) {
		dust.filters[k] = v;
	});
}

/**
 * Adds all of our default dust helpers to the dust object
 */
function add_default_dust_helpers() {
	this.add_dust_helpers({
		url : dust_url.bind(null, this.options)
	});
}

/**
 * Adds all of the given helpers to the dust object
 * @param helpers Object of user defined helpers, keys are names, and values are functions
 */
function add_dust_helpers(helpers) {
	_.each(helpers, function(v, k) {
		dust.helpers[k] = v;
	});
}

/**
 * Load routing modules from the given subdirectory, and recurse on directories inside
 * it.
 * @param path Directory to load routing modules from
 */
function load_routes(path) {
	logger.info('Loading routes from '+path.yellow, 'Common');

	var that = this;
	var files = fs.readdirSync(path);
	_.each(files, function(v) {
		if (v[0] == '.')
			return;

		fs.stat(path+'/'+v, function(err, stats) {
			if (stats.isDirectory())
				that.load_routes(path+'/'+v);
			else
				require('./'+path+'/'+v.replace(/\.js$/, '')).init_routes(that);
		});
	});
}

/**
 * Adds a route to the server, called from a routing module that we are loading
 * @param path The path to pass to express to match for this route
 * @param handler Hash of handler info, with three keys, fn, pre, and post
 * @param verb The http verb to attach to this route, optional, defaults to get
 */
function add_route(path, handler, verb) {
	verb = verb || 'get';
	this.server[verb].call(this.server, path, this.create_route(handler.fn, handler.pre, handler.post));
}

/**
 * Shutdown callback, registered for process termination, will call all of the shutdown
 * functions that are registered in turn.
 */
function shutdown() {
	logger.info('Shutdown received...', mod_name);

	// Each shutdown function takes a callback--the function to call when it is
	// done shutting down. Therefore, we convert the list of shutdown functions
	// into a chain where each function receives a pointer to the next one in
	// the chain, ending in a call to process.exit()
	var shutdown = this.options.shutdown.reduceRight(function(memo, v) {
		var ctx = v.ctx || this;
		return v.fn.bind(ctx, memo);
	}, process.exit, this);

	shutdown();
}

/**
 * Adds a function to a pre-handler chain. Technically, this is called after the router
 * in express, but it is called before the user-defined handler for that route is
 * given control
 * @param fn The function to add to a named pre-handler chain, result of fl.mkfn()
 * @param name The name of the chain, optional, defaults to 'default'
 */
function add_pre_hook(fn, name) {
	name = name || 'default';
	var hooks = get_chain(this.pre_hooks, name);
	hooks.push(fn);
}

/**
 * Adds a function to a post-handler chain. These functions are called after the user-
 * defined handler passes back control, but before the final output handler
 * @param fn The function to add to a post-handler chain, result of fl.mkfn()
 * @param name The name of the chain, optional, defaults to 'default'
 */
function add_post_hook(fn, name) {
	name = name || 'default';
	var hooks = get_chain(this.post_hooks, name);
	hooks.push(fn);
}

/**
 * Helper function to retrieve and create if necessary a chain with a specific name
 * @param chains Hash map of chains
 * @param name Name of chain to retrieve
 * @return Chain that matches the given name, or a new one one if none existed
 */
function get_chain(chains, name) {
	var ret = chains[name];

	if (ret === undefined) {
		ret = new fl.Chain();
		ret.name = name;
		chains[name] = ret;
	}

	return ret;
}

/**
 * Creates an environment object by using the flux link env creator and then adding
 * the useful methods that we need for the application framework built on top of it
 * @param req The http request to store in this environment
 * @param res The http response to store in this environment
 * @param options The options map from the server instance, to load useful things
 * @return Environment object
 */
function prepare_env(req, res, options) {
	var env = new fl.Environment({
		req : req,
		res : res,
		_page : {},
		_cmeta : {
			error : null,
			json : false,
			raw : false,
			template : '',
		},
	}, fl_error_log);

	// Attach useful functions; these require env self-references
	env.$error = set_error.bind(null, env);
	env.$json = set_json.bind(null, env);
	env.$output = set_output.bind(null, env);
	env.$template = set_template.bind(null, env);
	env.$raw = set_raw.bind(null, env);
	env.$redirect = set_redirect.bind(null, env, options.base_url);

	return env;
}

/**
 * Receives a routed request from express, calls the pre_hooks chain, then the user
 * callback, and then the post_hooks chain, and finally the output handler.
 * @param cb The user-defined callback, as a Chain or mkfn() output
 * @param pre Array of pre-hook chain names to include, in order. Defaults to ['default']
 * @param post Array of post-hook chain names to include, in order. Defaults to ['default']
 */
function create_route(cb, pre, post) {
	// Default values in case pre and post hooks were omitted
	pre = pre || ['default'];
	post = post || ['default'];

	// Map names to chains for hooks
	pre = pre.map(function(v, k) {
		return get_chain(this.pre_hooks, v);
	}, this);
	post = post.map(function(v, k) {
		return get_chain(this.post_hooks, v);
	}, this);

	// Create a single array with all of the appropriate hooks and handlers in place
	var handlers = pre.concat([cb], post);
	var handler_chain = new fl.Chain(handlers);
	handler_chain.set_exception_handler(handle_global_error);
	handler_chain.set_bind_after_env(true);
	handler_chain.name = 'Common Route Handler';
	var finish = this.finish.bind(this);
	finish.name = 'finish';

	// This function is suitable for passing to express's server/route definitions
	var that = this;
	return function(req, res) {
		var env = prepare_env(req, res, that.options);
		handler_chain.call(null, env, finish);
	};
}

/**
 * This finishes a request by parsing the out object from the environment, rendering
 * any templates that may be appropriate, and then sending the result to the browser
 * @todo http headers for content type, etc.
 * @todo additional output/debug data when we are missing metadata
 * @param env The environment that was used to handle the request
 */
function finish(env) {
	var rendertime = process.hrtime(env.res.start);
	env._page.rendertime = (new Number(rendertime[0]*1000 + rendertime[1]/1000000)).toFixed(1);
	var meta = env._cmeta;

	if (meta.error !== null) {
		send_error(env);
	}
	else if (meta.json) {
		env.res.send(env._page);
	}
	else if (meta.redirect) {
		env.res.set('Location', meta.redirect);
		env.res.send(302);
	}
	else if (meta.template != '') {
		dust.render(meta.template, env._page, function(err, out) {
			if (err) {
				env.$error(err, 'Unable to process dust template: "'+meta.template+'"');
				send_error(env);
			}
			else
				env.res.send(out);
		});
	}
	else if (meta.raw) {
		// Do nothing, because raw output was already supplied earlier in the chain
		logger.warn('Raw mode used to handle request. Consider finding and rewriting the offending code!');
	}
	else {
		logger.warn('No output metadata supplied in environment.');
		env.res.send(500, 'No output generated.');
	}
}

/**
 * Mark this request response as an error, to be passed through the error template
 * @param env The environment to mark
 * @param err The error object in question, for server-side debuggin
 * @param msg The error message to send to the user
 * @param name The module name where the error occurred
 */
function set_error(env, err, msg, name) {
	env._cmeta.error = err;
	_.extend(env._cmeta.error, {
		_msg : msg,
		_modname : name
	});
}

/**
 * Mark this request response as json, to be passed back strictly as such. This
 * will non-destructively update the page, so that we can set fields piecemeal
 * @param env The environment to mark
 * @param obj The object to format with json and pass back
 */
function set_json(env, obj) {
	env._cmeta.json = true;
	set_output(env, obj);
}

/**
 * Set part of the page output
 * @param env The environment in which to modify the output
 * @param obj A hash of values to push into the page output
 */
function set_output(env, obj) {
	_.extend(env._page, obj);
}

/**
 * Sets the template to be used for rendering this page when the request ends
 * @param env The environment to update
 * @param template String name of the template to use for rendering
 */
function set_template(env, template) {
	env._cmeta.template = template;
}

/**
 * Mark this request as having been raw-handled earlier in the chain, so
 * we do not send any output back to the browser now
 * @param env The environment to update
 */
function set_raw(env) {
	env._cmeta.raw = true;
}

/**
 * Set this response up to work as a redirect when it comes time to render the
 * page template
 * @param env The environment to update
 * @param base The base url to prepend onto the redirect path
 * @param path The redirect path, generally something like /foo/bar
 */
function set_redirect(env, base, path) {
	env._cmeta.redirect = base+path;
}

/**
 * This handles a global-level error (i.e. one uncaught by an embedded chain)
 * by converting the environment's output to an error message. It also catches
 * the exception so that finish() is guaranteed to run
 * handler is invoked.
 * @param env The request environment that has experienced a global-level error
 * @param err An optional error object that will be passed to set_error
 * @param msg An optional user-visible messgae that will be passed to set_error
 * @param mod An optional module name that will be passed to set_error
 */
function handle_global_error(env, err, msg, mod) {
	env.$error(err, msg, mod);
	env.$catch();
}

/**
 * Handles an error within fl that should never occur by simply logging it. If
 * this error happens, it represents a bug in the application.
 * @param msg Error message to log
 */
function fl_error_log(msg) {
	logger.debug(msg, 'Common');
}

/**
 * Helper function used to handle statically served files, makes for cheap config
 * @param path The path to the file to serve statically
 */
function static_serve(path) {
	return function(req, res) {
		res.sendfile(path, function(err) {
			res.send(404, 'Unable to locate '+path);
		});
	}
}

/**
 * Renders the dust error template and sends the response to the user.
 * @param env The environment that contains the request in question
 * @todo Add some proper http headers
 */
function send_error(env) {
	var modname = env._cmeta.error._modname || mod_name;
	var msg = env._cmeta.error._msg || 'An undescribed error occurred.';

	// Log the error that happened
	//logger.info('Error occurred while handling route: ' + env.req.route.path, modname);
	logger.var_dump(env._cmeta.error, {src : modname});

	// Render the dust template for the user
	var content = _.extend({}, env._page, env._cmeta.error);
	dust.render('error', content, function(err, out) {
		if (err) {
			logger.error('Unable to render debug template.', modname);
			env.res.send(500, msg + '<br /><br />Additionally, an error occurred while rendering the error template');
		}
		else {
			env.res.send(out);
		}
	});
}

/**
 * Error handler in case we fail to match a route (final fallback)
 * @param err The error that occurred
 * @param req The http request object
 * @param res The http response object
 * @param next The next handler to invoke if we're not happy
 */
function handle_server_error(err, req, res, next) {
	var env = prepare_env(req, res);

	env.$error(err, 'No matching route for requested path', mod_name);
	send_error(env);
}

/**
 * Dust helper for url creation that helps deal with domain and port changes
 */
function dust_url(opts, chunk, ctx, bodies, params) {
	var url = dust.helpers.tap(params.url, chunk, ctx);

	// Only prepend our base url if we're looking for something relative to it
	if (url[0] == '/')
		return chunk.write(opts.base_url + url);
	else
		return chunk.write(url);
}

// Create class definition based around common.init
_.extend(init.prototype, {
	load_dust_templates			: load_dust_templates,
	add_default_dust_filters	: add_default_dust_filters,
	add_dust_filters			: add_dust_filters,
	add_default_dust_helpers	: add_default_dust_helpers,
	add_dust_helpers			: add_dust_helpers,
	shutdown					: shutdown,
	add_pre_hook				: add_pre_hook,
	add_post_hook				: add_post_hook,
	create_route				: create_route,
	load_routes					: load_routes,
	add_route					: add_route,
	finish 						: finish
});

// Common interface for callers
module.exports.init = init;
module.exports.static_serve = static_serve;
