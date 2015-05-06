"use strict";

require('es6-promise').polyfill();
var fs = require('fs');
var denodeify = require('denodeify');
var exec = denodeify(require('child_process').exec, function (err, stdout, stderr) {
	return [err, stdout];
});
var deployStatic = require('next-build-tools').deployStatic;
var GitHubApi = require('github');
var github = new GitHubApi({
	version: "3.0.0",
	debug: "true"
});

// env variables
var pr = process.env.TRAVIS_PULL_REQUEST;
var commit = process.env.GIT_HASH;
var commitLong = process.env.GIT_LONG_HASH;
var gitHubOauth = process.env.GITHUB_OAUTH;

// parameters and config data -- assumes file lives in tests/visual/config/
var argv = require('minimist')(process.argv.slice(2));
var configfile = "./" + argv.t;
var page_data = require('./config/' + configfile).testData;
var prod_data = require('./config/' + configfile).productionData;

var page;
var screenshots;
var failures;
var date = new Date();
var current_day = getDayName(date);
var timeString = date.getUTCHours() + "h"
	+ date.getUTCMinutes() + "m"
	+ date.getUTCMilliseconds() + "ms";

var aws_shot_dest = "image_diffs/" + prod_data.app_name + "/" + current_day + "/" + timeString + "__" + commit + "/screenshots/";
var aws_fail_dest = "image_diffs/" + prod_data.app_name + "/" + current_day + "/" + timeString + "__" + commit + "/failures/";
var aws_shots_index = "https://s3-eu-west-1.amazonaws.com/ft-next-qa/" + aws_shot_dest + "index.html";
var aws_fails_index = "https://s3-eu-west-1.amazonaws.com/ft-next-qa/" + aws_fail_dest + "index.html";


console.log("Running image diff tests");

startImageDiffs()
	.then(function (result) {

		return new Promise(function (resolve, reject) {

			console.log("\n\nCasperJS output: \n\n" + result);

			if (fs.existsSync("tests/visual/screenshots")) {

				// find all screenshots and build an html page to display them
				screenshots = fs.readdirSync("tests/visual/screenshots");

				var screenshotspage = buildIndexPage(screenshots);
				fs.writeFile("tests/visual/screenshots/index.html", screenshotspage);

				// add path to screenshots
				for (var x = 0; x < screenshots.length; x++) {
					screenshots[x] = "tests/visual/screenshots/" + screenshots[x];
				}
				console.log("Screenshots located at " + aws_shots_index);

			} else {
				console.log("No screenshots here");
			}

			if (fs.existsSync("tests/visual/failures")) {

				failures = fs.readdirSync("tests/visual/failures");

				var failurespage = buildIndexPage(failures);
				fs.writeFile("tests/visual/failures/index.html", failurespage);

				// add path to failures
				for (var y = 0; y < failures.length; y++) {
					failures[y] = "tests/visual/failures/" + failures[y];
				}

				console.log("Failure screenshots located at " + aws_fails_index);

			} else {
				console.log("No failures found");
			}
			resolve("Success");
		});

	})
	.then(function (result) {

		return new Promise(function (resolve, reject) {
			console.log("Screenshot result: " + result);

			deployToAWS(screenshots, aws_shot_dest);
			deployToAWS(["tests/visual/screenshots/index.html"], aws_shot_dest);

			if (pr && failures !== undefined) {
				deployToAWS(failures, aws_fail_dest);
				deployToAWS(["tests/visual/failures/index.html"], aws_fail_dest);
			}

			resolve("Success");

		});
	})
	.then(function (result) {

		return new Promise(function (resolve, reject) {
			console.log("AWS Deploy Result: " + result);
			console.log("Updating github");

			// Make a comment if we have failures on a PR
			if (pr && failures !== undefined) {

				github.authenticate({
					type: "oauth",
					token: gitHubOauth
				});

				github.pullRequests.createComment({
					user: "Financial-Times",
					repo: "grumman",
					number: pr,
					body: "Image diffs found between branch and production" +
					"\nSee" +
					"\n\n" + aws_fails_index,
					commit_id: commitLong
				});
			} else {
				console.log("No comments to make to Pull Request");
			}

			resolve("Success");

		});

	})

	.catch(function (err) {
		console.log("there was an error");
		console.log(err.stack);
	});


function startImageDiffs() {
	var imageDiffPromises = [];

	for (page in page_data) {
		if (page_data.hasOwnProperty(page)) {

			var testURL = "http://" + process.env.TEST_HOST + ".herokuapp.com";
			var prodHost = prod_data.host;
			var prodSuffix = prod_data.canary;
			var page_name = page_data[page].name;
			var page_path = page_data[page].path;
			var widths = collectWidths(page_data[page]);
			for (var x = 0; x < widths.length; x++) {
				var width = widths[x];
				var elements = getAllElementsOnWidth(page_data[page], width);

				var test = "\nPage name  : " + page_name +
					"\npath       : " + page_path +
					"\nwidth      : " + width +
					"\nheight     : 1000" +
					"\ntestURL    : " + testURL +
					"\nprodhost   : " + prodHost +
					"\nprodsuffix : " + prodSuffix +
					"\nelements " + JSON.stringify(elements);

				console.log("Starting test for " + test);
				imageDiffPromises.push(
					startTestProcess(width, page_name, page_path, elements, testURL, prodHost, prodSuffix)
				);
			}
		}
	}
	return Promise.all(imageDiffPromises);
}

function startTestProcess(width, page_name, page_path, elements, testURL, prodHost, prodSuffix) {
	var args = [
		"--width='" + width + "'",
		"--height=1000",
		"--pagename='" + page_name + "'",
		"--path='" + page_path + "'",
		"--elements='" + JSON.stringify(elements) + "'",
		"--testurl='" + testURL + "'",
		"--prodhost='" + prodHost + "'",
		"--prodsuffix='" + prodSuffix + "'",
		"test",
		"tests/visual/elements_test.js"
	].join(' ');
	return exec("casperjs " + args);
}


function getAllElementsOnWidth(json, width) {
	var elementObject = {};
	var item;
	for (item in json.elements) {
		if (json.elements.hasOwnProperty(item)) {
			var element = json.elements[item];
			var widths = element.widths;
			if (widths.indexOf(width) === -1) {
			} else {
				elementObject[element.name] = element.css;
			}
		}
	}
	return elementObject;
}

function collectWidths(json) {
	var compiledWidths = [];
	var item;
	for (item in json.elements) {
		if (json.elements.hasOwnProperty(item)) {
			var widths = json.elements[item].widths;
			for (var x = 0; x < widths.length; x++) {
				if (compiledWidths.indexOf(widths[x]) === -1) {
					compiledWidths.push(widths[x]);
				}
			}
		}
	}
	return compiledWidths;
}

function getDayName(date) {
	var weekday = new Array(7);
	weekday[0] = "Sunday";
	weekday[1] = "Monday";
	weekday[2] = "Tuesday";
	weekday[3] = "Wednesday";
	weekday[4] = "Thursday";
	weekday[5] = "Friday";
	weekday[6] = "Saturday";
	return weekday[date.getDay()].toLowerCase();
}

function buildIndexPage(screenshots) {
	var html = "<html><body>";
	for (var j = 0; j < screenshots.length; j++) {
		if (screenshots[j].indexOf("base.png") !== -1) {
			var matchingshot = screenshots[j].replace("base.png", "test.png");
			html += "<p>" + screenshots[j] + "</p>" +
			'<p><p></p></p><img src="' + screenshots[j] + '">' + "</p>";
			html += "<p>" + matchingshot + "</p>" +
			'<p><p></p><img src="' + matchingshot + '">' + "</p>";
		}
	}
	html += "</body></html>";
	return html;
}

function deployToAWS(files, destination) {
	deployStatic({
		files: files,
		destination: destination,
		region: 'eu-west-1',
		bucket: 'ft-next-qa',
		strip: 3
	});
}
