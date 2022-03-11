class Drink {
	
	constructor(){
		this.size = "Gr";
		this.drinkName = "Latte";
		this.drinkType = "Espresso";
		this.hot = true;
		this.mods = new Array();
		this.syrups = new Array();
	}
	
	toInnerHTML(){
		if(this.hot){
			return "<b>" + this.size + " " + this.drinkName + "</b>";
		} else {
			return "<b>" + this.size + " Icd " + this.drinkName + "</b>";
		}
	}
	
	randomize(){
		var randInt;
		//Randomize the drink type
		randInt = randomInteger(2);
		
		if (randInt == 0){
			this.drinkType = "Espresso";
		} else if (randInt == 1){
			this.drinkType = "Trenta";
		} else if (randInt == 2){
			this.drinkType = "Frapp";
		}
		
		
		//Randomize whether drink is hot or iced
		if (this.drinkType === "Espresso"){
			if(randomInteger(1) == 1){
				this.hot = true;
			} else {
				this.hot = false;
			}
		}
		
		//Randomize Size
		if (this.drinkType === "Espresso"){
			randInt = randomInteger(3);
			if (randInt == 0){
				if (this.hot){
					this.size = "Sh";
				} else {
					this.size = "Vt";
				}
			} else if (randInt == 1){
				this.size = "Tl";
			} else if (randInt == 2){
				this.size = "Gr";
			} else {
				this.size = "Vt";
			}
		} else if (this.drinkType === "Trenta") {
			randInt = randomInteger(3);
			if (randInt == 0){
				this.size = "Tr";
			} else if (randInt == 1){
				this.size = "Tl";
			} else if (randInt == 2){
				this.size = "Gr";
			} else {
				this.size = "Vt";
			} 
		} else {
			randInt = randomInteger(2);
			if (randInt == 0){
				this.size = "Tl";
			} else if (randInt == 1){
				this.size = "Gr";
			} else {
				this.size = "Vt";
			} 
		}
		
		// Randomize Drinkname
		/* ------Drink possibilities------
			Espresso: Latte, Shaken Espresso, Cappucino, Caramel Macch.,
				Mocha, White Mocha, Flat White, Americano,
				Tea Lattes - Chai, REB, London Fog (not esp but fits category)
				
			TrentaAvlbl: Cold Brew, Iced Coffee, Shaken Green Tea,
				Shaken Black Tea, Shaken Passion Tea, Lemonade, 
				
			Frapps: Caramel Frapp, Mocha Frapp, Mocha Cookie Crumble Frapp,
				Caramel Ribbon Crunch Frapp, Vanilla Bean Frapp, Strawberry Frapp,
				
			Other: Brewed Coffee, Nitro Cold Brew, Hot Brewed Teas (Earl Grey,
					Emperor's Cloud & Mist, English Bfast, Mint Maj, Jade Citrus,
					Peach Tranq, Honey Citrus Mint, 
		
		*/
		
		if(this.drinkType == "Espresso"){
			randInt = randomInteger(7);
			if(randInt == 0){
				this.drinkName = "Latte";
			} else if (randInt == 1){
				this.drinkName = "Shkn Espr";
			} else if (randInt == 2){
				this.drinkName = "Cappucino";
			} else if (randInt == 3){
				this.drinkName = "Caramel Macch";
			} else if (randInt == 4){
				this.drinkName = "Mocha";
			} else if (randInt == 5){
				this.drinkName = "White Mocha";
			} else if (randInt == 6){
				this.drinkName = "Flat White";
			} else if (randInt == 7){
				this.drinkName = "Americano";
			}
		} else if (this.drinkType == "Trenta") {
			randInt = randomInteger(17);
			
			if(randInt == 0){
				this.drinkName = "Icd Coff";
			} else if (randInt == 1){
				this.drinkName = "Cold Brew";
			} else if (randInt == 2){
				this.drinkName = "Shk Grn Tea";
			} else if (randInt == 3){
				this.drinkName = "Shk Grn Tea Lmnd";
			} else if (randInt == 4){
				this.drinkName = "Shk Pch Grn Tea Lmnd";
			} else if (randInt == 5){
				this.drinkName = "Shk Blk Tea";
			} else if (randInt == 6){
				this.drinkName = "Shk Blk Tea Lmnd";
			} else if (randInt == 7){
				this.drinkName = "Shk Psn Tea";
			} else if (randInt == 8){
				this.drinkName = "Shk Psn Tea Lmnd";
			}  else if (randInt == 9){
				this.drinkName = "Pink Drink";
			}  else if (randInt == 10){
				this.drinkName = "Dragon Drink";
			}  else if (randInt == 11){
				this.drinkName = "Star Drink";
			}  else if (randInt == 12){
				this.drinkName = "Str Acai Rfrshr";
			} else if (randInt == 13){
				this.drinkName = "Str Acai Rfrshr Lmnd";
			}  else if (randInt == 14){
				this.drinkName = "Mango Drgnf Rfrshr Lmnd";
			} else if (randInt == 15){
				this.drinkName = "Mango Drgnf Rfrshr";
			} else if (randInt == 16){
				this.drinkName = "Kiwi Stfrt Rfrshr";
			} else if (randInt == 17){
				this.drinkName = "Kiwi Stfrt Rfrshr Lmnd";
			}
		} else if (this.drinkType == "Frapp") {
			randInt = randomInteger(12);
			if(randInt == 0){
				this.drinkName = "Caramel Frap";
			} else if (randInt == 1){
				this.drinkName = "Mocha Frap";
			} else if (randInt == 2){
				this.drinkName = "Vanilla Bean Crmfr";
			} else if (randInt == 3){
				this.drinkName = "Strawberry Crmfr";
			} else if (randInt == 4){
				this.drinkName = "Mcha Cookie Crmbl Frap";
			} else if (randInt == 5){
				this.drinkName = "Crml Rbn Crnch Frap";
			} else if (randInt == 6){
				this.drinkName = "Crml Rbn Crnch Crmfr";
			} else if (randInt == 7){
				this.drinkName = "Choc Cookie Crmbl Crmfr";
			} else if (randInt == 8){
				this.drinkName = "2Chc Chip Crmfr";
			} else if (randInt == 9){
				this.drinkName = "Java Chip Frap";
			} else if (randInt == 10){
				this.drinkName = "Coffee Frap";
			} else if (randInt == 11){
				this.drinkName = "Espresso Frap";
			} else if (randInt == 12){
				this.drinkName = "Caffe Vanilla Frap";
			}
		}
	}
	
	addRandomMod(){
		
	}
	
	addRandomSyrup(){
		
	}
}

// Returns and random integer from 0 to x
function randomInteger(x){
	return Math.floor(Math.random() * (x + 1));
}
function Generate(){
	
	let myDrink = new Drink();
	myDrink.randomize();
	document.getElementById("mainDrink").innerHTML = myDrink.toInnerHTML();
}
