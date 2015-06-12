//
// Copyright (c) Autodesk, Inc. All rights reserved
//
// Node.js server workflow
// by Cyrille Fauvel - Autodesk Developer Network (ADN)
// January 2015
//
// Permission to use, copy, modify, and distribute this software in
// object code form for any purpose and without fee is hereby granted,
// provided that the above copyright notice appears in all copies and
// that both that copyright notice and the limited warranty and
// restricted rights notice below appear in all supporting
// documentation.
//
// AUTODESK PROVIDES THIS PROGRAM "AS IS" AND WITH ALL FAULTS.
// AUTODESK SPECIFICALLY DISCLAIMS ANY IMPLIED WARRANTY OF
// MERCHANTABILITY OR FITNESS FOR A PARTICULAR USE.  AUTODESK, INC.
// DOES NOT WARRANT THAT THE OPERATION OF THE PROGRAM WILL BE
// UNINTERRUPTED OR ERROR FREE.
//
var express =require ('express') ;
var request =require ('request') ;
// unirest (http://unirest.io/) or SuperAgent (http://visionmedia.github.io/superagent/)
var unirest =require('unirest') ;
var events =require('events') ;
var util =require ('util') ;
var path =require ('path') ;
var fs =require ('fs') ;
var config =require ('./credentials') ;

function Lmv (bucketName, accessToken) {
	events.EventEmitter.call (this) ;
	this.bucket =bucketName ;
	this.accessToken =accessToken ;
}
//Lmv.prototype.__proto__ =events.EventEmitter.prototype ;
util.inherits (Lmv, events.EventEmitter) ;

// GET /oss/v1/buckets/:bucket/details
Lmv.prototype.checkBucket =function () {
	var self =this ;
	unirest.get (util.format (config.getBucketsDetailsEndPoint, self.bucket))
		.header ('Accept', 'application/json')
		.header ('Content-Type', 'application/json')
		.header ('Authorization', 'Bearer ' + self.accessToken)
		//.query (params)
		.end (function (response) {
			try {
				if ( response.statusCode != 200 )
					throw response ;
				try { self.emit ('success', response.body) ; } catch ( err ) {}
			} catch ( err ) {
				self.emit ('fail', err) ;
			}
		})
	;
	return (this) ;
} ;

// POST /oss/v1/buckets
Lmv.prototype.createBucket =function (policy) {
	policy =policy || 'transient' ;
	var self =this ;
	unirest.post (config.postBucketsEndPoint)
		.header ('Accept', 'application/json')
		.header ('Content-Type', 'application/json')
		.header ('Authorization', 'Bearer ' + self.accessToken)
		.send ({ 'bucketKey': self.bucket, 'policy': policy })
		.end (function (response) {
			try {
				if ( response.statusCode != 200 || !response.body.hasOwnProperty ('key') )
					throw response ;
				try { self.emit ('success', response.body) ; } catch ( err ) {}
			} catch ( err ) {
				self.emit ('fail', err) ;
			}
		})
	;
	return (this) ;
} ;

Lmv.prototype.createBucketIfNotExist =function (policy) {
	policy =policy || 'transient' ;
	var self =this ;

	unirest.get (util.format (config.getBucketsDetailsEndPoint, self.bucket))
		.header ('Accept', 'application/json')
		.header ('Content-Type', 'application/json')
		.header ('Authorization', 'Bearer ' + self.accessToken)
		//.query (params)
		.end (function (response) {
			try {
				if ( response.statusCode != 200 )
					throw response ;
				try { self.emit ('success', response.body) ; } catch ( err ) {}
			} catch ( err ) {
				//- We need to create one if error == 404 (404 Not Found)
				if ( Number.isInteger (err.statusCode) && err.statusCode == 404 ) {
					unirest.post (config.postBucketsEndPoint)
						.header ('Accept', 'application/json')
						.header ('Content-Type', 'application/json')
						.header ('Authorization', 'Bearer ' + self.accessToken)
						.send ({ 'bucketKey': self.bucket, 'policy': policy })
						.end (function (response) {
							try {
								if ( response.statusCode != 200 || !response.body.hasOwnProperty ('key') )
									throw response ;
								try { self.emit ('success', response.body) ; } catch ( err ) {}
							} catch ( err ) {
								self.emit ('fail', err) ;
							}
						})
					;
				} else {
					self.emit ('fail', err) ;
				}
			}
		})
	;
	return (this) ;
} ;

// PUT /oss/v1/buckets/:bucket/objects/:filename
Lmv.prototype.uploadFile =function (filename) {
	var self =this ;
	var serverFile =path.normalize (__dirname + '/../' + filename) ;
	var localFile =path.basename (filename) ;

	var file =fs.readFile (serverFile, function (err, data) {
		if ( err )
			return (self.emit ('fail', err)) ;

		var endpoint =util.format (config.getputFileUploadEndPoint, self.bucket, localFile.replace (/ /g, '+')) ;
		unirest.put (endpoint)
			.headers ({
				'Accept': 'application/json',
				'Content-Type': 'application/octet-stream',
				'Authorization': ('Bearer ' + self.accessToken)
			})
			.send (data)
			.end (function (response) {
				try {
					if ( response.statusCode != 200 )
						throw response ;
					try { self.emit ('success', response.body) ; } catch ( err ) {}
				} catch ( err ) {
					self.emit ('fail', err) ;
				}
			})
		;
	}) ;
	return (this) ;
} ;

// POST /viewingservice/v1/register
Lmv.prototype.register =function (urn) {
	var self =this ;
	//var urn =this.getURN (connections ['lmv-root'] [0]) ;
	var desc ={ 'urn': new Buffer (urn).toString ('base64') } ;

	unirest.post (config.postRegisterEndPoint)
		.headers ({
			'Accept': 'application/json',
			'Content-Type': 'application/json',
			'Authorization': ('Bearer ' + self.accessToken)
		})
		.send (desc)
		.end (function (response) {
			try {
				if ( response.statusCode != 200 && response.statusCode != 201 )
					throw response ;
				try { self.emit ('success', { 'urn': desc.urn, 'response': response.body }) ; } catch ( err ) {}
			} catch ( err ) {
				self.emit ('fail', err) ;
			}
		})
	;
	return (this) ;
} ;

Lmv.prototype.status =function (urn, params) {
	var self =this ;
	params =params || {} ;

	var endpoint =util.format (config.getStatusEndPoint, urn) ;
	unirest.get (endpoint)
		.headers ({
			'Accept': 'application/json',
			'Content-Type': 'application/json',
			'Authorization': ('Bearer ' + self.accessToken)
		})
		.query (params)
		.end (function (response) {
			try {
				if ( response.statusCode != 200 )
					throw response ;
				try { self.emit ('success', response.body) ; } catch ( err ) {}
			} catch ( err ) {
				self.emit ('fail', err) ;
			}
		})
	;
	return (this) ;
} ;

var router =express.Router () ;
router.Lmv =Lmv ;
module.exports =router ;

// Utility
if ( !Number.isInteger ) {
	Number.isInteger =function isInteger (nVal) {
		return (
			   typeof nVal === 'number'
			&& isFinite (nVal)
			&& nVal > -9007199254740992
			&& nVal < 9007199254740992
			&& Math.floor (nVal) === nVal
		) ;
	} ;
}
