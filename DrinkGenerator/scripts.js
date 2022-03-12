class Drink {
	
    size;
    drinkName;
    mods;
    syrups;
    milk;
    possibleMods;
    possibleSyrups;
    possibleMilks;
    
	constructor(_drinkName){
		this.size = "Gr";
		this.drinkName = _drinkName;
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
        
        //determine whether to add random syrups, then add up to 3
        var addRandomSyrups = randomInteger(2);
        var amtSyrupsToAdd;
        if (addRandomSyrups >= 1){
            amtSyrupsToAdd = randomInteger(3);
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
    
    constructor(_drinkName){
        super(_drinkName);
    }
    
    randomize(){
        super.randomize();
    }
}

class Espresso extends ChargeMilk {
    shots;
    
    constructor(_drinkName){
        super(_drinkName);
        this.shots = 0;
    }
    
    randomizeShots(){
        const currShots = this.shots;
        while (this.shots == currShots){
            this.shots = randomInteger(this.shots + 3);
            if (this.shots == 0){
                this.shots = 1;
            }
        }
    }
    randomize(){

        super.randomize();
    }

}

class Hot extends Espresso {
    constructor(_drinkName){
        super(_drinkName);
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
        randInt = randomInteger(1);
        if (randInt == 0){
            this.randomizeShots();
            this.mods.push(this.shots + " Shot");
        }
        
    }
    
}
class Iced extends Espresso {
    
    constructor(_drinkName){
        super(_drinkName);
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
    constructor(_drinkName){
        super(_drinkName);
    }
    
    randomize(){
        super.randomize();

    }
}


class NoChargeMilk extends Drink {
    constructor(_drinkName){
        super(_drinkName);
        this.possibleMilks = ['w/ 2% Milk 1/2"', 'w/ Whole Milk 1/2"', 'w/ Coconut Milk 1/2"', 'w/ Almond Milk 1/2"', 'w/ Soy Milk 1/2"', 'w/ Oat Milk 1/2"', 'w/ Nonfat Milk 1/2"', 'w/ Half & Half 1/2"', 'w/ Heavy Cream 1/2"'];
    }
    
    randomize(){
        super.randomize();
    }
    
}

//possible sizes tall thru trenta
class Trenta extends NoChargeMilk {
    constructor(_drinkName){
        super(_drinkName);
    }
    
    randomize(){
        
        super.randomize();

        const drinkSizes = ["Tl", "Gr", "Vt", "Tr"];
        var randInt = randomInteger(3);
        this.size = drinkSizes[randInt];
        
    }
}

//possible sizes tall thru venti
class CoffeeTea extends NoChargeMilk {
    constructor(_drinkName){
        super(_drinkName);
    }
    
    randomize(){
        
        super.randomize();

    }
}

//possible sizes tall and grande
class Nitro extends NoChargeMilk {
    constructor(_drinkName){
        super(_drinkName);
    }
    
    randomize(){
        
        super.randomize();

        const drinkSizes = ["Tl", "Gr"];
        var randInt = randomInteger(1);
        this.size = drinkSizes[randInt];
    }
}


// Returns and random integer from 0 to x
function randomInteger(x){
	return Math.floor(Math.random() * (x + 1));
}

function Generate(){
    const trDrinkNames = ["Shk Grn Tea", "Shk Grn Tea Lmnd", "Shk Pch Grn Tea Lmnd", "Shk Blk Tea", "Shk Blk Tea Lmnd","Shk Psn Tea", "Shk Psn Tea Lmnd","Pink Drink","Dragon Drink","Star Drink","Str Acai Rfrshr","Str Acai Rfrshr Lmnd", "Mango Drgnf Rfrshr Lmnd","Mango Drgnf Rfrshr", "Kiwi Stfrt Rfrshr", "Kiwi Stfrt Rfrshr Lmnd"];
    const espDrinkNames = ["Latte", "Cappucino", "Caramel Macch", "Mocha", "White Mocha", "Flat White", "Americano"];
    const frapDrinkNames = ["Caramel Frap","Mocha Frap","Vbean Crmfr","Strawberry Crmfr","Mcha Cookie Crmbl Frap","Crml Rbn Crnch Frap","Crml Rbn Crnch Crmfr","Choc Cookie Crmbl Crmfr","2Chc Chip Crmfr","Java Chip Frap","Coffee Frap","Espresso Frap","Caffe Vanilla Frap"];
    const brewedHotCoffeeNames = ["Pike Place Roast", "Blonde Roast", "Dark Roast"];
    const nitroDrinkNames = ["Nitro Cold Brew", "Nitro CB W/ VSC", "Sltd Crml CF NCB"];
    const hotTeaNames = ["Earl Grey", "Emp Cloud & Mist", "Mint Majsty", "Jade Ctrs Mint", "Peach Tranq", "Honey Citrus Mint", "Royal English Breakfast", "Brewed Chai Tea"];
    const brewedColdCoffeeNames = ["Icd Coff", "Cold Brew", "Vnlla Swt Crm Cld Brw", "Salted Crml Cf CB"];
    
    const trDrinks                   =    [];
    const espHotDrinks               =    [];
    const espIcdDrinks               =    [];
    const frapDrinks                 =    [];
    const brewedHotCoffeeDrinks      =    [];
    const nitroDrinks                =    [];
    const hotTeaDrinks               =    []; 
    const brewedColdCoffeeDrinks     =    [];
    
    if (!document.getElementById("excIcdTea").checked){
        for (var i = 0; i < trDrinkNames.length; i++){
            trDrinks.push(new Trenta(trDrinkNames[i]));
        }
    }
    if (!document.getElementById("excHotTea").checked){
        for (var i = 0; i < hotTeaNames.length; i++){
            hotTeaDrinks.push(new CoffeeTea(hotTeaNames[i]));
        }
    }
    if (!document.getElementById("excHotEsp").checked){
        for (var i = 0; i < espDrinkNames.length; i++){
            espHotDrinks.push(new Hot(espDrinkNames[i]));
        }
    }
    if (!document.getElementById("excColdEsp").checked){
        for (var i = 0; i < espDrinkNames.length; i++){
            espIcdDrinks.push(new Iced(espDrinkNames[i]));
        }
        espIcdDrinks.push(new Iced("Shkn Espr"));
    }
    if (!document.getElementById("excFrap").checked){
        for (var i = 0; i < frapDrinkNames.length; i++){
            frapDrinks.push(new Frapp(frapDrinkNames[i]));
        }
    }

    if (!document.getElementById("excBrewed").checked){
        for (var i = 0; i < nitroDrinkNames.length; i++){
            nitroDrinks.push(new Nitro(nitroDrinkNames[i]));
        }
        for (var i = 0; i < brewedHotCoffeeNames.length; i++){
            brewedHotCoffeeDrinks.push(new CoffeeTea(brewedHotCoffeeNames[i]));
        }
        for (var i = 0; i < brewedColdCoffeeNames.length; i++){
            brewedColdCoffeeDrinks.push(new Trenta(brewedColdCoffeeNames[i]));
        }
    }
    
    const masterDrinkList = espHotDrinks.concat(espIcdDrinks, frapDrinks, nitroDrinks, trDrinks, brewedHotCoffeeDrinks, brewedColdCoffeeDrinks, hotTeaDrinks);
    
	var randInt = randomInteger(masterDrinkList.length - 1);;
	var myDrink = masterDrinkList[randInt];
    
	myDrink.randomize();
    
    
	document.getElementById("mainDrink").innerHTML = myDrink.toInnerHTML();
}
