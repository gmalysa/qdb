
var base_url = 'http://qdb.swcombine.com';

function vote(url, id) {
	$.getJSON(url, function(data) {
		if (data.err == undefined) {
			$('#score_'+id).html(data.score);

			if (data.vote == 1) {
				$('#up_'+id).attr('src', base_url+'/static/images/up_voted.png');
				$('#down_'+id).attr('src', base_url+'/static/images/down.png');
			}
			else if (data.vote == -1) {
				$('#down_'+id).attr('src', base_url+'/static/images/down_voted.png');
				$('#up_'+id).attr('src', base_url+'/static/images/up.png');
			}
			else {
				$('#down_'+id).attr('src', base_url+'/static/images/down.png');
				$('#up_'+id).attr('src', base_url+'/static/images/up.png');
			}
		}
	});
}

function approve_quote(id) {
	$.getJSON(base_url+'/admin/approve/'+id, function(data) {
		if (data.err == undefined)
			$('#quote_'+id).css('display', 'none');
	});
}

function reject_quote(id) {
	$.getJSON(base_url+'/admin/reject/'+id, function(data) {
		if (data.err === undefined)
			$('#quote_'+id).css('display', 'none');
	});
}

function delete_quote(id) {
	$.getJSON(base_url+'/quote/'+id+'/delete', function(data) {
		if (data.success)
			$('#quote_'+id).css('display', 'none');
	});
}

function unban(ip) {
	$.getJSON(base_url+'/admin/ban/remove/'+ip, function(data) {
		if (data.err) {
			if (data.msg) {
				alert(data.msg);
			}
		}
		else {
			$('#ban_'+ip.replace(/\./g, '_')).css('display', 'none');
		}
	});
}
