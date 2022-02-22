var count = 0;
if (!sessionStorage.getItem("count")){
	count = 0;
	sessionStorage.setItem("count", count);
} else {
	count = parseInt(sessionStorage.getItem("count"));
}

function increment(){
	count = count + 1;
	sessionStorage.setItem("count", count);
	document.getElementById('incrementButton').innerHTML = "Runs: " + sessionStorage.getItem("count");
}
	
function reset(){
	if (confirm('This cannot be undone - are you sure?')){
		count = 0;
		sessionStorage.setItem("count", count);
	}
	document.getElementById('incrementButton').innerHTML = "Runs: " + sessionStorage.getItem("count");
}

function hide(){
	var PatchTwoFourAreas = document.querySelectorAll('.twofourflag');
	var i = 0;
	var length = PatchTwoFourAreas.length;
	
	for(i; i < length; i++){
		PatchTwoFourAreas[i].hidden = true;
	}
}
	
function show(){
	var PatchTwoFourAreas = document.querySelectorAll('.twofourflag');
	var i = 0;
	var length = PatchTwoFourAreas.length;
	
	for(i; i < length; i++){
		PatchTwoFourAreas[i].hidden = false;;
	}
}