/**
 * Androret - Consistent JSON Response Format
 * Used to standardize API responses with status and dynamic data
 */

interface IAndroret<T = any> {
  status: string | number;
  data: T;
}

/**
 * Androret class for creating consistent JSON responses
 * Usage: new Androret('success', dynamicData).toJSON()
 */
class Androret<T = any> {
  private status: string | number;
  private data: T;

  constructor(status: string | number, data: T) {
    this.status = status;
    this.data = data;
  }

  /**
   * Returns the response as a JSON object
   */
  toJSON(): IAndroret<T> {
    return {
      status: this.status,
      data: this.data,
    };
  }

  /**
   * Static factory method for creating responses
   */
  static create<T = any>(status: string | number, data: T): IAndroret<T> {
    return new Androret(status, data).toJSON();
  }

  /**
   * Returns the response as a JSON string
   */
  toString(): string {
    return JSON.stringify(this.toJSON());
  }
}

export default Androret;
export { IAndroret };
