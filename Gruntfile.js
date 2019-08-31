/**
 * Gruntfile to handle synchronizing common files with the baselayout so
 * that I can edit them in a project and then push the changes to baselayout
 * easily. Similarly, I can then download it in other projects
 */

var _ = require('underscore');
var exec = require('child_process').exec;
var fs = require('fs');

module.exports = function(grunt) {
	var files = ['logger.js', 'common.js', 'mysql.js'];
	var bldir = '/home/greg/git/baselayout/root/';
	var clientdir = './client/';
	var staticdir = './static/';

	grunt.registerTask('default', 'Options listing', function() {
		grunt.log.writeln('Available tasks are:\nup - download latest from baselayout\nci - commit changes to baselayout files\njs - minify client js and update static folder\ncss - compile less css into static folder');
	});

	grunt.registerTask('up', 'Download latest versions of common files from baselayout', function() {
		_.each(files, function(v) {
			grunt.log.writeln('Updating file '+v);
			exec('cp '+bldir+v+' '+v);
		});
	});

	grunt.registerTask('ci', 'Commit changes to common files in baselayout', function() {
		_.each(files, function(v) {
			grunt.log.writeln('Pushing file '+v);
			exec('cp '+v+' '+bldir+v);
		});
	});

	grunt.registerTask('js', 'Minify client javascript and update the static folder with new versions', function() {
		files = fs.readdirSync(clientdir+'javascript');
		_.each(files, function(v, k) {
			if (v[0] == '.')
				return;
			grunt.log.writeln('Uglifying javascript '+v);
			exec('uglifyjs -m -c -r "$,_" '+clientdir+'javascript/'+v+' -o '+staticdir+'javascript/'+v);
		});
	});

	grunt.registerTask('css', 'Compile LESS css scripts and update static folder', function() {
		files = fs.readdirSync(clientdir+'css');
		_.each(files, function(v, k) {
			if (v[0] == '.')
				return;
			grunt.log.writeln('Compiling LESS file '+v);
			exec('lessc -x '+clientdir+'css/'+v+' > '+staticdir+'css/'+v);
		});
	});
}
