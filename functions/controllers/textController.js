
const mongoose = require("mongoose");
const { Text } = require("../models/Text");
const { ref, uploadBytes, getDownloadURL } = require("firebase/storage");
const { fileParser } = require("express-multipart-file-parser");
const path = require("path");
const { app, firebaseStorage } = require("../firebaseConfig");

const uploadFileToFirebase = async (
    fileBuffer,
    filename,
    eventId,
    isSample,
    i
  ) => {
    try {
      let storageRef;
      if (isSample === "true") {
        storageRef = ref(
          firebaseStorage,
          `sample/sample${i}${i === "zip" ? ".zip" : ".png"}`
        );
      } else {
        storageRef = ref(firebaseStorage, `uploads/${eventId}/${filename}`);
      }
      const snapshot = await uploadBytes(storageRef, fileBuffer);
      const downloadURL = await getDownloadURL(snapshot.ref);
      return downloadURL;
    } catch (error) {
      console.error("Error uploading file to Firebase:", error);
      throw error;
    }
  };
  const uploadFile = async (req ,res) =>{
    const { eventId} = req.query;
    let inputFilePath = req.files.find((val) => val.fieldname === "pawan");
    const buffer = inputFilePath.buffer;

    console.log(inputFilePath);
    const patToFile = inputFilePath.originalname;

   const fileExtension = path.extname(patToFile)

   const fileName = eventId +"file" + fileExtension;
   console.log(fileName)
   const url = await uploadFileToFirebase(buffer,fileName,eventId,false,0)
    if(!url){
        return res.status(400).json({ message: "Error uploading image" });
    }
    const file = await Text.findOneAndUpdate({eventId},{
        $set: {
            inputFile: url
        }
    },{new: true});
    return res.status(200).json({file});
    
  }


const saveText = async (req, res) => {
    const {
        texts
    } = req.body;

    console.log("fffff", texts)
    const { eventId } = req.query;
    if (!texts) return res.status(400).json({ message: "Text not found" });
    if (!eventId) return res.status(400).json({ message: "Event ID not found"});

  
        const textss = await Text.aggregate([
            {
                $match: {
                    eventId: new mongoose.Types.ObjectId(eventId)
                }
            }, 
        ])

  
if (textss.length <= 0 ) {
    try {
        const textUpload = await Text.create({
            eventId,
            texts:[...texts],
        });

     
        if (!textUpload) {
            return res.status(400).json({ message: "Error uploading text" });
        }

        return res.status(200).json(textUpload);
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal server error" });
    }
} else {
    try {
        const updatedTexts = await Text.findOneAndUpdate(
            {eventId},
            {
                $set:{
                    texts:texts,
                }
            },
            {new:true}
        )
        if (!updatedTexts) {
            return res.status(400).json({ message: "Error updating text" });
        }
        return res.status(200).json(updatedTexts);

    } catch (error) {
        console.log(error);
    }
}
    
}







const getTexts = async (req, res) => {
    // const user = req.user?._id;
    const { eventId } = req.query;
    
    if (!eventId) return res.status(400).json({ message: "Event ID not found" });
    // if (!user) return res.status(400).json({ message: "User not found" });

    try {
        const texts = await Text.aggregate([
            {
                $match: {
                    eventId: new mongoose.Types.ObjectId(eventId)
                }
            },
            {
                $lookup: {
                    from: "events",
                    localField: "eventId",
                    foreignField: "_id",
                    as: "eventDetails",
                    pipeline: [
                        {
                            $project: {

                                eventId: 1,
                                texts:1,
                                inputFile:1
                            }
                        }
                    ]
                }
            },

            
            
        ]);

        return res.status(200).json(texts);
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal server error" });
    }
}




module.exports = {saveText,getTexts,uploadFile};