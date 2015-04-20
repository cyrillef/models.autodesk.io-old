//
// Copyright (c) Autodesk, Inc. All rights reserved 
//
// Host Node.js server 
// by Cyrille Fauvel - Autodesk Developer Network (ADN)
// April 2015
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
var oCountdown =null ;
var oDropZone =null ;
var oList =[] ;

$(document).ready (function () {
	// Initialization code
	var accessToken =$.cookie ('accessToken') ;
	if ( accessToken == "null" || accessToken == undefined || accessToken == "undefined" )
		HostResetAccessToken () ;
	else
		HostSetupAccessToken (JSON.parse (accessToken)) ;
	var oList =$.cookie ('models') ;
	if ( oList == "null" || oList == undefined || oList == "undefined" )
		oList =[] ;
	else
		HostSetupTranslated (JSON.parse (oList)) ;

	// Access Token request code
	$('#btnGetAccessToken').click (function (evt) {
		$.ajax ({
			url: 'http://' + window.location.host + '/api/token',
			type: 'post',
			data: JSON.stringify ({ 'key': $('#publicKey').val ().trim (), 'secret': $('#secretKey').val ().trim () }),
			contentType: 'application/json',
			complete: null
		}).done (function (data) {
			var date =new Date () ;
			date.setTime (date.getTime () + (parseInt (data.expires_in) * 1000)) ; // ~30 minutes
			data.expires_at =date.toString () ;
			HostSetupAccessToken (data) ;
			$.cookie ('accessToken', JSON.stringify (data), { expires: date }) ; //, secure: true }) ;
		}) ;
	}) ;
	
	$('#btnReleaseAccessToken').click (function (evt) {
		oCountdown.stop () ;
	}) ;

	// Translation process code
	$('#btnTranslateThisOne').click (function (evt) {
		var sample =$('#inputModellist').val () ;
		if ( sample != '' )
			translate (sample) ;
	}) ;

	// Drag 'n Drop zone code
    fd.jQuery () ;
    $('#zone')
        .filedrop ()
		.on ('fdsend', function (e, files) { // Occurs when FileDrop's 'send' event is initiated.
			//$('#bar_zone10').css ('width', 0) ;
			$("#bar_zone10").val (0) ;
			$.each (files, function (i, file) {
				file.sendTo ('/api/file') ;
			}) ;
		})
		.on ('fileprogress', function (e, file, current, total) {
			var width =current / total * 100 ;
			$("#bar_zone10").val (width) ;
			//$('#bar_zone10').css ('width', width) ;
		})
        .on ('fileerror', function (e, file) {
            if ( file.xhr.readyState == 4 && !file.xhr.status ) {
                alert ('Timeout reached, request aborted.') ;
            } else {
                alert (file.xhr.status + ', ' + file.xhr.statusText) ;
            }
        })
        .on ('filedone', function (e, file) { // Occurs when a File object has done uploading.
            //alert ('Done uploading ' + file.name + ' on ' + this.tagName) ;
			translate ('uploads/' + file.name) ;
        })
	;
}) ;

function HostSetupAccessToken (data) {
	$('#accessToken').val (data.access_token) ;
	$('#publicKey').val ('') ;
	$('#secretKey').val ('') ;
	
	var now =new Date () ;
	var to =new Date (data.expires_at) ;
	var diff = (to.getTime () / 1000) - (now.getTime () / 1000) ;
	oCountdown =$('#countdown').FlipClock (diff, {
		countdown: true,
		clockFace: 'MinuteCounter',
		stop: function () {
			oCountdown.timer._clearInterval () ;
			HostResetAccessToken () ;
			//alert ('Your Access Token has now expired') ;
			$('#modal-accesstoken').modal ('show') ;
		}
	}) ;

	$('#myModelsDiv').show () ;
	$('#chooseModelsDiv').show () ;
	$('#accessTokenMainDiv').show () ;
	$('#keysMainDiv').hide () ;
}

function HostResetAccessToken () {
	$('#accessToken').val ('') ;
	
	$.cookie ('accessToken', null) ;
	$.cookie ('models', null) ;

	$('#myModelsDiv').hide () ;
	$('#accessTokenMainDiv').hide () ;
	$('#chooseModelsDiv').hide () ;
	$('#keysMainDiv').show () ;
}

function HostSetupTranslated (data) {
	for ( var i =0 ; i < data.length ; i++ ) {
		var id =data [i].urn.replace (/=+/g, '') ;
		$('#translated').append ('<div class="list-group-item row" id="' + id + '">'
			+ '<div class="col-md-4">' + data [i].item + '</div>'
			+ '<div class="col-md-8"><input type="text" class="form-control" value="' + data [i].urn + '" readonly="true" /></div>'
			+ '</div>') ;
	}
}

function translate (filename) {
	var accessToken =$.cookie ('accessToken') ;
	accessToken =JSON.parse (accessToken) ;

	$.ajax ({
		url: '/api/translate',
		type: 'post',
		timeout: 0,
		data: JSON.stringify ({ 'accessToken': accessToken, 'file': filename }),
		contentType: 'application/json',
		complete: null
	}).done (function (data) {
		var fn =filename.replace (/^.*[\\\/]/, '') ;
		oList.push ({ item: fn, urn: data.urn }) ;
		$.cookie ('models', JSON.stringify (oList)) ;

		var id =data.urn.replace (/=+/g, '') ;
		$('#translating').append ('<div class="list-group-item" id="' + id + '">'
			+ '<span>' + fn + '</span><progress min="0" max="100" value="0" />'
			+ '</div>') ;
		setTimeout (function () { translateProgress (data.urn) ; }, 5000) ;
	}).fail (function (xhr, ajaxOptions, thrownError) {
		$('#modal-translationfailed').modal ('show') ;
	}) ; ;
}

function translateProgress (urn) {
	var accessToken =$.cookie ('accessToken') ;
	accessToken =JSON.parse (accessToken) ;

	$.ajax ({
		url: '/api/translate/' + urn + '/progress',
		type: 'get',
		data: { 'accessToken': accessToken.access_token },
		contentType: 'application/json',
		complete: null
	}).done (function (response) {
		var id =response.urn.replace (/=+/g, '') ;
		if ( response.progress == 'complete' ) {
			$('#' + id).remove () ;
			$('#translated').append ('<div class="list-group-item row" id="' + id + '">'
				+ '<div class="col-md-4">' + response.children [0].name + '</div>'
				+ '<div class="col-md-8"><input type="text" class="form-control" value="' + response.urn + '" readonly="true" /></div>'
				+ '</div>') ;
		} else {
			$('#' + id + ' progress').val (parseInt (response.progress)) ;
			setTimeout (function () { translateProgress (urn) ; }, 500) ;
		}
	}).fail (function (xhr, ajaxOptions, thrownError) {
		console.log ('Progress request failed!') ;
		var id =urn.replace (/=+/g, '') ;
		var filename =$('#' + id + ' span').text () ;
		$('#' + id).remove () ;
		$('#translated').append ('<div class="list-group-item" id="' + id + '">'
			+ '<span>' + filename + '</span>'
			+ '<span>failed</span>'
			+ '</div>') ;
	}) ;
} ;