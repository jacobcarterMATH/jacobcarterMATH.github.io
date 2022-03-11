class Drink {
	
    size;
    drinkName;
    mods;
    syrups;
    milk;
    possibleMods;
    possibleSyrups;
    possibleMilks;
	constructor(){
		this.size = "Gr";
		this.drinkName = "Latte";
		this.mods = [];
		this.syrups = [];
        this.possibleMods = ["Caramel Drizzle", "Mocha Drizzle", "Vanilla Sweet Cream CF", "Salted Crml CF", "Whipped Cream", "Cinnamon Powder", "Cinnamon Dolce Powder", "Cocoa Powder", "Salted Brown Butter Topping", "Vanilla Bean Powder"];
        this.possibleSyrups = ["Vanilla Syrup", "Hazelnut Syrup", "Caramel Syrup", "White Mocha", "Mocha", "Toffee Nut Syrup", "Classic Syrup", "Brown Sugar Syrup", "SF Vanilla Syrup", "Raspberry Syrup"];
        this.possibleMilks = ["2% Milk", "Whole Milk", "Coconut Milk", "Almond Milk", "Soy Milk", "Oat Milk", "Nonfat Milk", "Breve", "Heavy Cream"];
	}
	
    modsToInnerHTML(){
        var returnString = "";
        
        //Add syrups to inner HTML
        for (var i = 0; i < this.syrups.length; i++){
            returnString = returnString.concat(" <br> " + this.syrups[i]);
        }
        
        for (var i = 0; i < this.mods.length; i++){
            returnString = returnString.concat(" <br> " + this.mods[i]);
        }
        return returnString;
        
    }
    
	toInnerHTML(){
        var retString = "<b>" + this.size + " " + this.drinkName + "</b>";
        
        retString = retString + this.modsToInnerHTML();
		return retString;
	}
    

	
	randomize(){
		var randInt;
        const drinkSizes = ["Tl", "Gr", "Vt"];
        randInt = randomInteger(2);
        this.size = drinkSizes[randInt];
        
        //determine whether to add random syrups, then add up to 5
        var addRandomSyrups = randomInteger(2);
        var amtSyrupsToAdd;
        if (addRandomSyrups >= 1){
            amtSyrupsToAdd = randomInteger(5);
            for (var i = 0; i < amtSyrupsToAdd; i++){
                this.addRandomSyrup();
            }
        }
        
        //add chance to customize syrup amounts, then do it if so
        var custSyrupAmt;
        var randSyrupAmt;
        var pumpsAmt = "";
        for (var i = 0; i < this.syrups.length; i++){
            custSyrupAmt = randomInteger(1);
            if (custSyrupAmt == 1){
                randSyrupAmt = randomInteger(12);
                if (randSyrupAmt == 0){
                    randSyrupAmt = 1;
                }
                pumpsAmt = randSyrupAmt.toString() + " pumps ";
                this.syrups[i] = pumpsAmt.concat(this.syrups[i]);
            }
        }
        
        //determine whether to add random mods, then add up to 5 
        var addRandomMods = randomInteger(2);
        var amtModsToAdd;
        if (addRandomMods >= 1){
            amtModsToAdd = randomInteger(5);
            for (var i = 0; i < amtModsToAdd; i++){
                this.addRandomMod();
            }
        }
        
        //determine whether to change the milk, then change it if so
        var changeMilk = randomInteger(1);
        if (changeMilk == 1){
            this.pickRandomMilk();
        }
	}
	
    pickRandomMilk(){
        var randInt;
        randInt = randomInteger(this.possibleMilks.length - 1);
        this.mods.push(this.possibleMilks[randInt]);
        
    }
	addRandomMod(){
        
        var randInt;
        randInt = randomInteger(this.possibleMods.length - 1);
        if (!this.mods.includes(this.possibleMods[randInt])){
            this.mods.push(this.possibleMods[randInt]);
        }
	}
	
	addRandomSyrup(){
		var randInt;
        randInt = randomInteger(this.possibleSyrups.length - 1);
        if (!this.syrups.includes(this.possibleSyrups[randInt])){
            this.syrups.push(this.possibleSyrups[randInt]);
        }
	}
}

class ChargeMilk extends Drink {
    
    constructor(){
        super();
    }
    
    randomize(){
        super.randomize();
    }
}

class Espresso extends ChargeMilk {
    shots;
    
    constructor(){
        super();
        this.shots = 0;
    }
    
    randomizeShots(){
        const currShots = this.shots;
        while (this.shots == currShots){
            this.shots = randomInteger(8);
        }
    }
    randomize(){
        //Randomize the drink name
        const drinkNames = ["Latte", "Shkn Espr", "Cappucino", "Caramel Macch", "Mocha", "White Mocha", "Flat White", "Americano"];
        var randInt = randomInteger(7);
        this.drinkName = drinkNames[randInt];
        super.randomize();
    }

}

class Hot extends Espresso {
    constructor(){
        super();
    }
    
    initShots(){
        if (this.size == "Sh"){
            this.shots = 1;
        } else if (this.size == "Tl"){
            this.shots = 1;
        } else if (this.size == "Gr"){
            this.shots = 2;
        } else if (this.size == "Vt"){
            this.shots = 2;
        }
    }
    
    randomize(){
        super.randomize();
        //Randomize the drink size
        const drinkSizes = ["Sh", "Tl", "Gr", "Vt"];
        var randInt = randomInteger(3);
        this.size = drinkSizes[randInt];
        this.initShots();
    }
    
}
class Iced extends Espresso {
    
    constructor(){
        super();
    }
    
    initShots(){
        if (this.size == "Tl"){
            this.shots = 1;
        } else if (this.size == "Gr"){
            this.shots = 2;
        } else if (this.size == "Vt"){
            this.shots = 3;
        }
    }
    
    randomize(){
        super.randomize();
        this.initShots();
    }
    
    toInnerHTML(){
        var retString = "<b>" + this.size + " Icd " + this.drinkName + "</b>";
        
        retString = retString + this.modsToInnerHTML();
		return retString;
	}
}

class Frapp extends ChargeMilk{
    constructor(){
        super();
    }
    
    randomize(){
        super.randomize();
        
        const drinkNames = ["Caramel Frap","Mocha Frap","VBean Crmfr","Strawberry Crmfr","Mcha Cookie Crmbl Frap","Crml Rbn Crnch Frap","Crml Rbn Crnch Crmfr","Choc Cookie Crmbl Crmfr","2Chc Chip Crmfr","Java Chip Frap","Coffee Frap","Espresso Frap","Caffe Vanilla Frap"];
        var randInt = randomInteger(drinkNames.length - 1);
        this.drinkName = drinkNames[randInt];
    }
}


class NoChargeMilk extends Drink {
    constructor(){
        super();
    }
    
    randomize(){
        super.randomize();
    }
}

//possible sizes tall thru trenta
class Trenta extends NoChargeMilk {
    constructor(){
        super();
    }
    
    randomize(){
        
        super.randomize();
        const drinkNames = ["Icd Coff", "Cold Brew", "Shk Grn Tea", "Shk Grn Tea Lmnd", "Shk Pch Grn Tea Lmnd", "Shk Blk Tea", "Shk Blk Tea Lmnd","Shk Psn Tea", "Shk Psn Tea Lmnd","Pink Drink","Dragon Drink","Star Drink","Str Acai Rfrshr","Str Acai Rfrshr Lmnd", "Mango Drgnf Rfrshr Lmnd","Mango Drgnf Rfrshr", "Kiwi Stfrt Rfrshr", "Kiwi Stfrt Rfrshr Lmnd"];
        var randInt = randomInteger(drinkNames.length - 1);
        this.drinkName = drinkNames[randInt];
        
        const drinkSizes = ["Tl", "Gr", "Vt", "Tr"];
        randInt = randomInteger(3);
        this.size = drinkSizes[randInt];
    }
}

//possible sizes tall thru venti
class CoffeeTea extends NoChargeMilk {
    constructor(){
        super();
    }
    
    randomize(){
        
        super.randomize();
        const drinkNames = ["Pike Place Roast", "Earl Grey", "Emp Cloud & Mist", "Mint Majsty", "Jade Ctrs Mint", "Peach Tranq", "Honey Citrus Mint"];
        var randInt = randomInteger(drinkNames.length - 1);
        this.drinkName = drinkNames[randInt];
    }
}

//possible sizes tall and grande
class Nitro extends NoChargeMilk {
    constructor(){
        super();
    }
    
    randomize(){
        
        super.randomize();
        const drinkNames = ["Nitro Cold Brew", "Nitro CB W/ VSC", "Sltd Crml CF NCB"];
        var randInt = randomInteger(drinkNames.length - 1);
        this.drinkName = drinkNames[randInt];
        
        const drinkSizes = ["Tl", "Gr"];
        randInt = randomInteger(1);
        this.size = drinkSizes[randInt];
    }
}


// Returns and random integer from 0 to x
function randomInteger(x){
	return Math.floor(Math.random() * (x + 1));
}

function Generate(){
	var randInt;
	let myDrink = new Drink();
    randInt = randomInteger(5);
    if (randInt == 0){
         myDrink = new Hot();
    } else if (randInt == 1){
         myDrink = new Iced();
    } else if (randInt == 2){
         myDrink = new Frapp();
    } else if (randInt == 3){
         myDrink = new Trenta();
    } else if (randInt == 4){
         myDrink = new CoffeeTea();
    } else if (randInt == 5){
         myDrink = new Nitro();
    }
    
	myDrink.randomize();

	document.getElementById("mainDrink").innerHTML = myDrink.toInnerHTML();
}
