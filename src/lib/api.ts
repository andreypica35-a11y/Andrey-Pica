/**
 * Safely handles API responses by checking for valid JSON and standardizing error formats.
 */
export async function safeFetch(url: string, options: RequestInit) {
  try {
    const response = await fetch(url, options);
    
    // Check if the response is JSON
    const contentType = response.headers.get("content-type");
    const isJson = contentType && contentType.includes("application/json");
    
    let data;
    if (isJson) {
      data = await response.json();
    } else {
      // Fallback: Read as text if not JSON
      const text = await response.text();
      console.warn(`[SafeFetch] Received non-JSON response from ${url}:`, text);
      
      // If it's an error status, create a standardized error object
      if (!response.ok) {
        return {
          success: false,
          message: `Server Error (${response.status}): ${text.slice(0, 100)}${text.length > 100 ? '...' : ''}`,
          status: response.status
        };
      }
      
      return {
        success: true,
        message: text,
        status: response.status
      };
    }

    // Standardize the response format if it's not already
    if (typeof data === 'object' && data !== null) {
      // If backend returned { error: "..." } instead of { success: false, message: "..." }
      if (data.error && !data.message) {
        data.message = data.error;
        data.success = false;
      }
      
      // Ensure success field exists
      if (data.success === undefined) {
        data.success = response.ok;
      }
      
      // Ensure message field exists for errors
      if (!data.success && !data.message) {
        data.message = "An unknown error occurred on the server.";
      }
    } else {
      // Data is not an object, wrap it
      data = {
        success: response.ok,
        message: String(data)
      };
    }

    return {
      ...data,
      status: response.status
    };
  } catch (error: any) {
    console.error(`[SafeFetch] Network or Parsing Error for ${url}:`, error);
    return {
      success: false,
      message: error.message || "Network request failed. Please check your connection.",
      status: 0
    };
  }
}
