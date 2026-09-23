

**Open Source Workshop**  
**“Find The Two That Match” Interaction**  
**Specification Brief**

Curious Learning

Product Specification for  
“Creating Literacy Games with React Native” workshop

Prepared by: Ben Burrage \<bburrage@curiouslearning.org\>

| DOCUMENT REVISION HISTORY *assign date stamp/sign off to accepted versions* |  |  |
| :---- | :---- | :---- |
| **Date** | **Version No** | **Author** |
| Apr. 11th, 2017 | V.1 | bburrage@curiouslearning.org |
|  |  |  |

# Glossary

### MVP

Minimum Viable Product. A small, testable piece of completed software that provides value to a user.

# Project Difficulty and Information

This project’s difficulty rating is: Beginner / Intermediate

This project does not have an existing code base for reference.

This project can be completed with non-English language content.

# Purpose/objective

The pedagogical objective of the “Find The Two That Match” interaction paradigm is to connect two items as being the same or equivalent. An example would be connecting the word “cat” to the word “cat” or a lowercase letter “c” to an uppercase letter “C”.

# MVP Implementation

### UI Requirements

* A split interface where objects on one side of the interface will have a matching pair on the other side of the interface.  
* The objects to match should be placed on the appropriate side of the interface according to a JSON input file.

### Functional Requirements

* Starting objects can only be lowercase letters and uppercase letters.  
* A child can drag around an object ~~and leave it anywhere~~.  
* When you drag one object over another object within a defined tolerance, both objects should be highlighted in the UI.  
* On finger up after dragging an object-- if the object was placed within tolerance of another object, then check for equivalence between the objects.  
  a.) If objects are equivalent:  
- Play a celebration animation.   
- Play an audio file pronouncing the word or letter.  
  b.) If objects are NOT equivalent:   
- Play a negative feedback sound.  
- Repel the object you dragged back to the original location before the finger up event.

### Constraints

* A child cannot drag an object off the screen.

### Input Requirements

* Your application should be able to read in a JSON file with two arrays of objects to be matched (left side of the screen and right side of the screen).

### Provided Inputs

You will be given a JSON file which contains two arrays of objects to display in the UI. These two arrays contain a subarray to specify equivalences between objects.

The basic structure of the JSON will look something like:

{  
“trial\_num” : number, // a unique trial number for choosing what to load in the UI  
“left” : \[   
	{  
			“object\_id” : string, // a unique identifier of this object  
“pos” : number\[x, y\],  // an x, y coordinate pair for screen placement  
“target” : string, // what is the name of our target  
“pair\_id” : string\[ \] // array of object\_ids that are equivalent to the target  
		// ex: Lower case c and upper case C, rhyming words, etc.   
	},   
		...  
\],  
“right” : \[   
	{  
			“object\_id” : string, // // a unique identifier of this object  
“pos” : number\[x, y\],  // an x, y coordinate pair for screen placement  
“target” : string, // what is the name of our target  
“pair\_id” : string\[ \] // array of object\_ids that are equivalent to the target  
		// ex: Lower case c and upper case C, rhyming words, etc.   
	},  
	...  
\]  
}

Media Asset Considerations  
In this app, an object will also have an association with:

* An image file path representing the word or letter  
* An audio file path pronouncing the target word or letter

# Better Implementation

### Additional UI Requirements

* Add the ability to display audio-only objects in the UI.

### Additional Functional Requirements

* When a child taps an object, the audio to pronounce the word or letter the object represents should play.  
* Add the ability to check for equivalence between a letter and a letter audio.

# Great Implementation

### Additional Functional Requirements

* Add the ability to use words, pictures, and rhyming words as objects in the UI.  
* Add the ability to check for equivalence between words and pictures.  
* Add the ability to check for equivalence between rhyming words.