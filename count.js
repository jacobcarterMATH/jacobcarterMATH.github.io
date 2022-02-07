	let count = 0;
	var display = document.getElementById('display');
	function increment(){
		count = count + 1;
		document.getElementById('incrementButton').innerHTML = "Runs: " + count;
	}
	
	function reset(){
		if (confirm('This cannot be undone - are you sure?')){
			count = 0;
		}
		document.getElementById('incrementButton').innerHTML = "Runs: " + count;
	}