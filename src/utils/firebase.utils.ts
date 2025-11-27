import { auth, firestore, storage } from '../config/firebase';
import { DecodedIdToken } from 'firebase-admin/auth';

/**
 * Verify Firebase ID token
 * @param idToken - Firebase ID token from client
 * @returns Decoded token with user information
 */
export const verifyIdToken = async (idToken: string): Promise<DecodedIdToken> => {
  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error('Error verifying ID token:', error);
    throw new Error('Invalid or expired token');
  }
};

/**
 * Get user by UID
 * @param uid - Firebase user UID
 * @returns User record
 */
export const getUserByUid = async (uid: string) => {
  try {
    const userRecord = await auth.getUser(uid);
    return userRecord;
  } catch (error) {
    console.error('Error fetching user:', error);
    throw new Error('User not found');
  }
};

/**
 * Get user by email
 * @param email - User email
 * @returns User record
 */
export const getUserByEmail = async (email: string) => {
  try {
    const userRecord = await auth.getUserByEmail(email);
    return userRecord;
  } catch (error) {
    console.error('Error fetching user by email:', error);
    throw new Error('User not found');
  }
};

/**
 * Create a new user
 * @param email - User email
 * @param password - User password
 * @param displayName - User display name (optional)
 * @returns Created user record
 */
export const createUser = async (
  email: string,
  password: string,
  displayName?: string
) => {
  try {
    const userRecord = await auth.createUser({
      email,
      password,
      displayName,
    });
    return userRecord;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

/**
 * Update user
 * @param uid - Firebase user UID
 * @param properties - Properties to update
 * @returns Updated user record
 */
export const updateUser = async (uid: string, properties: any) => {
  try {
    const userRecord = await auth.updateUser(uid, properties);
    return userRecord;
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
};

/**
 * Delete user
 * @param uid - Firebase user UID
 */
export const deleteUser = async (uid: string) => {
  try {
    await auth.deleteUser(uid);
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
};

/**
 * Set custom user claims
 * @param uid - Firebase user UID
 * @param claims - Custom claims object
 */
export const setCustomClaims = async (uid: string, claims: object) => {
  try {
    await auth.setCustomUserClaims(uid, claims);
  } catch (error) {
    console.error('Error setting custom claims:', error);
    throw error;
  }
};

// Firestore utilities
export { firestore, storage };

/**
 * Get a document from Firestore
 * @param collection - Collection name
 * @param docId - Document ID
 * @returns Document data
 */
export const getDocument = async (collection: string, docId: string) => {
  try {
    const doc = await firestore.collection(collection).doc(docId).get();
    if (!doc.exists) {
      throw new Error('Document not found');
    }
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    console.error('Error getting document:', error);
    throw error;
  }
};

/**
 * Create or update a document in Firestore
 * @param collection - Collection name
 * @param docId - Document ID
 * @param data - Document data
 */
export const setDocument = async (
  collection: string,
  docId: string,
  data: any
) => {
  try {
    await firestore.collection(collection).doc(docId).set(data, { merge: true });
  } catch (error) {
    console.error('Error setting document:', error);
    throw error;
  }
};

/**
 * Delete a document from Firestore
 * @param collection - Collection name
 * @param docId - Document ID
 */
export const deleteDocument = async (collection: string, docId: string) => {
  try {
    await firestore.collection(collection).doc(docId).delete();
  } catch (error) {
    console.error('Error deleting document:', error);
    throw error;
  }
};

/**
 * Query documents from Firestore
 * @param collection - Collection name
 * @param field - Field to query
 * @param operator - Query operator
 * @param value - Value to compare
 * @returns Array of documents
 */
export const queryDocuments = async (
  collection: string,
  field: string,
  operator: FirebaseFirestore.WhereFilterOp,
  value: any
) => {
  try {
    const snapshot = await firestore
      .collection(collection)
      .where(field, operator, value)
      .get();
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error querying documents:', error);
    throw error;
  }
};

