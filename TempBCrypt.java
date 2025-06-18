import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

public class TempBCrypt {
    public static void main(String[] args) {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(12);
        
        // Generate multiple hashes for secretary123 to ensure we get a good one
        for (int i = 0; i < 3; i++) {
            String hash = encoder.encode("secretary123");
            System.out.println("Hash " + (i+1) + ": " + hash);
            
            // Test the hash immediately
            boolean matches = encoder.matches("secretary123", hash);
            System.out.println("Verification: " + matches);
            System.out.println("---");
        }
    }
} 