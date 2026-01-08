import { Router } from "express"
import express from "express"
import logger from "../../logger.js"
import DBRepository from "../repositories/postgres.repository.js"
import { upsertMemberFromShopify, createProductSubscription, updateProductSubscriptionById } from "../services/localExtraHealth.js";
import { formatMMDDYYYY, firstDayOfNextMonth, recurringBillingDate } from "../services/billingExtraHealth.js";
import SkioImp from "../implements/skio.imp.js";

const dbRepository = new DBRepository();
const router = Router();

const skioImp = new SkioImp("VS"); // Reemplaza con el alias de tu tienda

// EXTRA HEALTH ENDPOINTS
// Crea un nuevo usuario en ExtraHealth y en la base de datos 
router.post("/user", async (req, res) => {
  try {
    const { customer, products} = await req.body;

    const member = await upsertMemberFromShopify(customer);
    logger.info(`Member upserted with ID: ${member.id}`);
    
    const contractId = products[0].contract_id;
    console.log("contract id", contractId);
  
    const subInfo = await skioImp.subscriptionsByContract(contractId);
    console.log("subInfo" ,subInfo); 

    const dtEffective = firstDayOfNextMonth();
    const dtRecurring = recurringBillingDate(dtEffective, 4);

    const product = await createProductSubscription(member.id, {
      member_id: member.id,
      skio_subscription_id: subInfo[0],
      pdid: 45750,
      contract_id: products[0].contract_id,
      bPaid: true,
      dtEffective,
      dtRecurring,
    })

    // const updateProduct = await updateProductSubscriptionById(member.id, {
    //   dtEffective,
    //   dtRecurring,
    // })

    return res.status(201).json({
      ok: true,
      message: "User created successfully",
    });

  } catch (err) {
    console.error(err);
    res.status(400).json({ ok: false, error: err.message });
  }
});


// Encuentra usuario en la base de datos
// router.get("/extra-health/user/:token", async (req, res) => {

//   const { token } = req.params;
//   res.send(`GETTING USER ${token}`);
//   // try {
//   //   const extrahealth = new ExtraHealthImp()



//   //   return res.status(200).json({
//   //     ok: true,
//   //     message: "getting users",
//   //   });
//   // } catch (err) {
//   //   console.error(err);
//   //   res.status(400).json({ ok: false, error: err.message });
//   // }
// });

// Modificar usario en ExtraHealth y en la base de datos 
// router.put("/extra-health/user:token", async (req, res) => {
//   try {
//     const extrahealth = new ExtraHealthImp()
    


//     return res.status(200).json({
//       ok: true,
//       message: "User updated successfully",
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(400).json({ ok: false, error: err.message });
//   }
// });
// EXTRA HEALTH ENDPOINTS

export default router;