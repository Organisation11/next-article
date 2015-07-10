'use strict';
/*global Livefyre*/

const oCommentApi = require('o-comment-api');
const beacon = require('next-beacon-component');

const ACTIVE_CONFIG = 'prod';

const config = {
	test :
	{
		"suds": {
			"baseUrl": "//test.session-user-data.webservices.ft.com"
		},
		"ccs": {
			"baseUrl": "http://test.comment-creation.webservices.ft.com"
		},
		"cacheConfig": {
			"authBaseName": "comments-test-auth-",
			"initBaseName": "comments-test-init-"
		},
		"livefyre": {
			"networkName": "ft-1"
		}
	},
	prod : {
		"suds": {
			"baseUrl": "//session-user-data.webservices.ft.com",
			"endpoints": {
				"livefyre": {
					"init": "/v1/livefyre/init"
				},
				"user": {
					"updateUser": "/v1/user/updateuser",
					"getAuth": "/v1/user/getauth"
				}
			}
		},
		"ccs": {
			"baseUrl": "http://comment-creation-service.webservices.ft.com",
			"endpoints": {
				"getComments": "/v1/getComments",
				"postComment": "/v1/postComment"
			}
		},
		"cacheConfig": {
			"authBaseName": "comments-prod-auth-",
			"initBaseName": "comments-prod-init-"
		},
		"livefyre": {
			"networkName": "ft"
		}
	}
};

// just in case...
if(typeof console !== 'object' || !console.log){
	window.console = {log:function(){}};
}


function initLiveFyre(domId, uuid){
	return new Promise(function(resolve, reject){
		oCommentApi.api.getLivefyreInitConfig({
			elId: domId,
			articleId: uuid,
			url: document.location.href,
			title: document.title
		}, function (err, data) {
			if (err) {
				return reject(err);
			}

			resolve(data);
		});
	});
}

function getUserData(){
	return new Promise(function(resolve, reject){
		oCommentApi.api.getAuth(function (err, data) {
			if (err) {
				return reject(err);
			}

			if(!data.token){
				reject(new Error('No auth token found!'));
			}

			resolve(data);
		});
	});

}

function loadSideNotes(){
	return new Promise(function(resolve, reject) {
		Livefyre.require(['sidenotes#1', 'auth'], function (Sidenotes, Auth) {
			resolve([Sidenotes, Auth]);
		});
	});
}

function setupSideNotes(info, uuid, user, modules){
	var [Sidenotes, Auth] = modules;
	var convConfig = {
		network: 'ft.fyre.co',
		selectors:'.article__body > p',
		numSidenotesEl : '.sidenotes-info-container',
		siteId: info.siteId,
		articleId: uuid,
		checksum: info.checksum,
		collectionMeta: info.collectionMeta
	};

	var app = new Sidenotes(convConfig);
	Auth.delegate({
		login: function(callback){
			callback(null,{livefyre:user.token});
		}
	});
	return app;
}

function addTracking(app){
	console.log('Adding tracking', app);

	app.on('sidenotes.commentPosted', function(data){
		console.log('comment', data);
		beacon.fire('comment', { interaction: 'posted', sidenote: true });
	});
	app.on('sidenotes.commentVoted', function(data){
		beacon.fire('comment', { interaction: 'liked', sidenote: true, id: data.targetId });
	});
	app.on('sidenotes.commentShared', function(data){
		beacon.fire('comment', { interaction: 'shared', sidenote: true, id: data.targetId });
	});

	return Promise.resolve(null);
}

function init(uuid, flags) {
	if (!flags.get('livefyreSideNotes')) {
		return;
	}
	oCommentApi.setConfig(config[ACTIVE_CONFIG]);
	console.log(`using ${ACTIVE_CONFIG} config`);

	var info, user;

	document.querySelector('.article__body p').insertAdjacentHTML('beforebegin', '<div class="sidenotes-info-container"></div>');

	initLiveFyre('rhs-comments', uuid)
		.then(function (initResponse) {
			console.log('initResponse', initResponse);
			document.body.classList.add('sidenotes-active');
			info = initResponse;
			return getUserData();
		})
		.then(function(userData){
			console.log('userData', userData);
			user = userData;
			return loadSideNotes();
		})
		.then(function(Sidenotes){
			return setupSideNotes(info, uuid, user, Sidenotes);
		})
		.then(addTracking)
		.catch(function(err){
			console.log('Failed to set up side notes - is the user logged in?');
			console.error(err);
		});
}

module.exports = {
	init : init
};
