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

function decrement(){
	count = count - 1;
	if (count < 0) {
		count = 0;
	}
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

function hideTwoFour(){
	var PatchTwoFourAreas = document.querySelectorAll('.twofourflag');
	var i = 0;
	var length = PatchTwoFourAreas.length;
	
	for(i; i < length; i++){
		PatchTwoFourAreas[i].hidden = true;
	}
	
	var PrePatchTwoFourAreas = document.querySelectorAll('.pretwofourflag');
	var j = 0;
	var length = PrePatchTwoFourAreas.length;
	
	for (j; j < length; j++){
		PrePatchTwoFourAreas[j].hidden = false;
	}
}


function hideSideNav(){
	var SideNavElement = document.querySelector('.sidenav');
	
	SideNavElement.style.width = "0px";
	SideNavElement.style.border = "0px solid black";
	
	var AltSideNavElement = document.querySelector('.altsidenav');
	
	AltSideNavElement.style.width = "20px";
	AltSideNavElement.style.border = "5px solid black";

	var MainElement = document.querySelector('.main');
	MainElement.style.marginLeft = "0px";
	
	var HeaderAlignElement = document.querySelector('.headeralign');
	if (screen.width < 800){
		HeaderAlignElement.style.textAlign = "center"; 
	}
	
}

function showSideNav(){
	var SideNavElement = document.querySelector('.sidenav');
	var MainElement = document.querySelector('.main');
	
	if(screen.width > 800){
		SideNavElement.style.width = "130px";
		MainElement.style.marginLeft = "160px";
	} else {
		SideNavElement.style.width = "80px";
		MainElement.style.marginLeft = "110px";
	}
	SideNavElement.style.border = "5px solid black";
	
	var AltSideNavElement = document.querySelector('.altsidenav');
	
	AltSideNavElement.style.width = "0px";
	AltSideNavElement.style.border = "0px solid black";

	var HeaderAlignElement = document.querySelector('.headeralign');
	if (screen.width < 800){
		HeaderAlignElement.style.textAlign = "left"; 
	}
}

function scriptTest(){
	alert("test");
}
function hidePreTwoFour(){
	var PatchTwoFourAreas = document.querySelectorAll('.twofourflag');
	var i = 0;
	var length = PatchTwoFourAreas.length;
	
	for(i; i < length; i++){
		PatchTwoFourAreas[i].hidden = false;
	}
	
	var PrePatchTwoFourAreas = document.querySelectorAll('.pretwofourflag');
	var j = 0;
	var length = PrePatchTwoFourAreas.length;
	
	for (j; j < length; j++){
		PrePatchTwoFourAreas[j].hidden = true;
	}
}
	
function show(){
	var PatchTwoFourAreas = document.querySelectorAll('.twofourflag');
	var i = 0;
	var length = PatchTwoFourAreas.length;
	
	for(i; i < length; i++){
		PatchTwoFourAreas[i].hidden = false;
	}
}

function filterTableByName(){
	var filter = document.getElementById("filterByItem").value.toLowerCase();
	hideRows('prefix', 2, filter);
	
	hideRows('suffix', 2, filter);
	
	hideRows('charged', 1, filter);
}

function filterTableByStat(){
	var filter = document.getElementById("filterByStat").value.toLowerCase();

	hideRows('prefix', 1, filter);
	
	hideRows('suffix', 1, filter);

	hideRows('charged', 0, filter);

}

function hideRows(elementId, rowToFilter, filterString){
	var tableToFilter = document.getElementById(elementId);
	var rows = tableToFilter.rows;
	
		for (var i = 1; i < rows.length; i++){
		if (!(rows[i].getElementsByTagName("TD")[rowToFilter].innerHTML.toLowerCase().includes(filterString))){
			rows[i].hidden = true;
		} else {
			rows[i].hidden = false;
		}
	}
}
