
const mongoose = require("mongoose");
const { Text } = require("../models/Text");


const saveText = async (req, res) => {
    const {
        eventId,
        texts
    } = req.body;

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




module.exports = {saveText,getTexts};