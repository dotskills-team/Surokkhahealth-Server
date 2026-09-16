// import { Types } from "mongoose";

// export enum PlanType {
//     MONTHLY = "MONTHLY",
//     QUARTERLY = "QUARTERLY",
//     HALF_YEARLY = "HALF_YEARLY",
//     YEARLY = "YEARLY",
//     LIFETIME = "LIFETIME",
// }

// export interface IPlan {
//     type: PlanType;
//     durationInMonths: number;
//     regularPrice: number;
//     discountPrice: number;
// }

// export interface IPackagePartnerDiscount {
//     partner: Types.ObjectId;

//     discountPercent: number;

//     isActive: boolean;
// }

// export interface IInsurancePackage {
//     _id?: Types.ObjectId;

//     name: string;
//     slug: string;

//     featureImage?: string;
//     description?: string;

//     coverageAmount: number;

//     plans: IPlan[];

//     benefits: string[];
//     exclusions: string[];

//     partnerDiscounts?: IPackagePartnerDiscount[];

//     isActive: boolean;
//     isDeleted: boolean;

//     createdAt?: Date;
//     updatedAt?: Date;
// }


// Version 2 with joint 

import { Types } from "mongoose";

export enum PlanType {
    MONTHLY = "MONTHLY",
    QUARTERLY = "QUARTERLY",
    HALF_YEARLY = "HALF_YEARLY",
    YEARLY = "YEARLY",
    LIFETIME = "LIFETIME",
}

export interface IPlan {
    type: PlanType;
    durationInMonths: number;
    regularPrice: number;
    discountPrice: number;
}

export interface IPackagePartnerDiscount {
    partner: Types.ObjectId;

    discountPercent: number;

    isActive: boolean;
}

export interface IInsurancePackage {
    _id?: Types.ObjectId;

    name: string;
    slug: string;

    featureImage?: string;
    description?: string;

    coverageAmount: number;

    // true  -> this package covers 2 persons (Joint), needs a 2nd person's info at subscription time
    // false -> this package covers only 1 person (Single)
    isJoint: boolean;

    plans: IPlan[];

    benefits: string[];
    exclusions: string[];

    partnerDiscounts?: IPackagePartnerDiscount[];

    isActive: boolean;
    isDeleted: boolean;

    createdAt?: Date;
    updatedAt?: Date;
}