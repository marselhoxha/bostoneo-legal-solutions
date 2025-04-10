-- Clear existing data
SET FOREIGN_KEY_CHECKS=0;
DELETE FROM Invoice;
DELETE FROM Customer;
SET FOREIGN_KEY_CHECKS=1;

-- Insert 100 customers with realistic data
INSERT INTO Customer (id, name, email, type, status, address, phone, image_url, created_at) VALUES
(1, 'Acme Corporation', 'contact@acmecorp.com', 'BUSINESS', 'ACTIVE', '123 Financial District, Boston, MA 02110', '(617) 555-0101', 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=500&auto=format', NOW()),
(2, 'Boston Legal Associates', 'info@bostonlegal.com', 'BUSINESS', 'ACTIVE', '456 Beacon Street, Boston, MA 02215', '(617) 555-0102', 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=500&auto=format', NOW()),
(3, 'Green Earth Cafe', 'hello@greenearthcafe.com', 'BUSINESS', 'ACTIVE', '789 Newbury Street, Boston, MA 02116', '(617) 555-0103', 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=500&auto=format', NOW()),
(4, 'Tech Solutions Inc', 'support@techsolutions.com', 'BUSINESS', 'ACTIVE', '321 Boylston Street, Boston, MA 02116', '(617) 555-0104', 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=500&auto=format', NOW()),
(5, 'Creative Design Studio', 'info@creativestudio.com', 'BUSINESS', 'ACTIVE', '654 Tremont Street, Boston, MA 02118', '(617) 555-0105', 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=500&auto=format', NOW()),
(6, 'John Smith', 'john.smith@gmail.com', 'INDIVIDUAL', 'ACTIVE', '123 Commonwealth Ave, Boston, MA 02116', '(617) 555-0106', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format', NOW()),
(7, 'Sarah Johnson', 'sarah.johnson@yahoo.com', 'INDIVIDUAL', 'ACTIVE', '456 Marlborough St, Boston, MA 02115', '(617) 555-0107', 'https://images.unsplash.com/photo-1494790108377-be9c29d29330?w=500&auto=format', NOW()),
(8, 'Michael Brown', 'michael.brown@hotmail.com', 'INDIVIDUAL', 'ACTIVE', '789 Beacon St, Boston, MA 02215', '(617) 555-0108', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format', NOW()),
(9, 'Emily Davis', 'emily.davis@outlook.com', 'INDIVIDUAL', 'ACTIVE', '321 Newbury St, Boston, MA 02115', '(617) 555-0109', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500&auto=format', NOW()),
(10, 'David Wilson', 'david.wilson@gmail.com', 'INDIVIDUAL', 'ACTIVE', '654 Boylston St, Boston, MA 02116', '(617) 555-0110', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format', NOW()),
(11, 'Massachusetts General Hospital', 'billing@mgh.harvard.edu', 'BUSINESS', 'ACTIVE', '55 Fruit Street, Boston, MA 02114', '(617) 555-0111', 'https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=500&auto=format', NOW()),
(12, 'Boston University', 'finance@bu.edu', 'BUSINESS', 'ACTIVE', '1 Silber Way, Boston, MA 02215', '(617) 555-0112', 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=500&auto=format', NOW()),
(13, 'Fidelity Investments', 'contact@fidelity.com', 'BUSINESS', 'ACTIVE', '245 Summer Street, Boston, MA 02210', '(617) 555-0113', 'https://images.unsplash.com/photo-1560520653-9e0e4c89eb11?w=500&auto=format', NOW()),
(14, 'Boston Consulting Group', 'info@bcg.com', 'BUSINESS', 'ACTIVE', '200 Pier Four Blvd, Boston, MA 02210', '(617) 555-0114', 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=500&auto=format', NOW()),
(15, 'State Street Corporation', 'contact@statestreet.com', 'BUSINESS', 'ACTIVE', '1 Lincoln Street, Boston, MA 02111', '(617) 555-0115', 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=500&auto=format', NOW()),
(16, 'Lisa Anderson', 'lisa.anderson@gmail.com', 'INDIVIDUAL', 'ACTIVE', '123 Beacon Hill, Boston, MA 02108', '(617) 555-0116', 'https://images.unsplash.com/photo-1494790108377-be9c29d29330?w=500&auto=format', NOW()),
(17, 'Robert Taylor', 'robert.taylor@yahoo.com', 'INDIVIDUAL', 'ACTIVE', '456 Back Bay, Boston, MA 02116', '(617) 555-0117', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format', NOW()),
(18, 'Jennifer Martinez', 'jennifer.martinez@hotmail.com', 'INDIVIDUAL', 'ACTIVE', '789 South End, Boston, MA 02118', '(617) 555-0118', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format', NOW()),
(19, 'William Thompson', 'william.thompson@outlook.com', 'INDIVIDUAL', 'ACTIVE', '321 North End, Boston, MA 02113', '(617) 555-0119', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format', NOW()),
(20, 'Patricia Garcia', 'patricia.garcia@gmail.com', 'INDIVIDUAL', 'ACTIVE', '654 Charlestown, Boston, MA 02129', '(617) 555-0120', 'https://images.unsplash.com/photo-1494790108377-be9c29d29330?w=500&auto=format', NOW()),
(21, 'Dell EMC', 'contact@dell.com', 'BUSINESS', 'ACTIVE', '176 South Street, Hopkinton, MA 01748', '(508) 555-0121', 'https://images.unsplash.com/photo-1560520653-9e0e4c89eb11?w=500&auto=format', NOW()),
(22, 'Raytheon Technologies', 'info@raytheon.com', 'BUSINESS', 'ACTIVE', '870 Winter Street, Waltham, MA 02451', '(781) 555-0122', 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=500&auto=format', NOW()),
(23, 'Biogen', 'contact@biogen.com', 'BUSINESS', 'ACTIVE', '225 Binney Street, Cambridge, MA 02142', '(617) 555-0123', 'https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=500&auto=format', NOW()),
(24, 'Boston Scientific', 'info@bostonscientific.com', 'BUSINESS', 'ACTIVE', '300 Boston Scientific Way, Marlborough, MA 01752', '(508) 555-0124', 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=500&auto=format', NOW()),
(25, 'Thermo Fisher Scientific', 'contact@thermofisher.com', 'BUSINESS', 'ACTIVE', '168 Third Avenue, Waltham, MA 02451', '(781) 555-0125', 'https://images.unsplash.com/photo-1560520653-9e0e4c89eb11?w=500&auto=format', NOW()),
(26, 'James Rodriguez', 'james.rodriguez@gmail.com', 'INDIVIDUAL', 'ACTIVE', '123 Jamaica Plain, Boston, MA 02130', '(617) 555-0126', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format', NOW()),
(27, 'Mary Lee', 'mary.lee@yahoo.com', 'INDIVIDUAL', 'ACTIVE', '456 Roslindale, Boston, MA 02131', '(617) 555-0127', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format', NOW()),
(28, 'Thomas White', 'thomas.white@hotmail.com', 'INDIVIDUAL', 'ACTIVE', '789 West Roxbury, Boston, MA 02132', '(617) 555-0128', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format', NOW()),
(29, 'Nancy Clark', 'nancy.clark@outlook.com', 'INDIVIDUAL', 'ACTIVE', '321 Hyde Park, Boston, MA 02136', '(617) 555-0129', 'https://images.unsplash.com/photo-1494790108377-be9c29d29330?w=500&auto=format', NOW()),
(30, 'Daniel Hall', 'daniel.hall@gmail.com', 'INDIVIDUAL', 'ACTIVE', '654 Mattapan, Boston, MA 02126', '(617) 555-0130', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format', NOW()),
(31, 'Wayfair', 'contact@wayfair.com', 'BUSINESS', 'ACTIVE', '4 Copley Place, Boston, MA 02116', '(617) 555-0131', 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=500&auto=format', NOW()),
(32, 'HubSpot', 'info@hubspot.com', 'BUSINESS', 'ACTIVE', '2 Canal Park, Cambridge, MA 02141', '(617) 555-0132', 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=500&auto=format', NOW()),
(33, 'Akamai Technologies', 'contact@akamai.com', 'BUSINESS', 'ACTIVE', '145 Broadway, Cambridge, MA 02142', '(617) 555-0133', 'https://images.unsplash.com/photo-1560520653-9e0e4c89eb11?w=500&auto=format', NOW()),
(34, 'TripAdvisor', 'info@tripadvisor.com', 'BUSINESS', 'ACTIVE', '400 1st Avenue, Needham, MA 02494', '(781) 555-0134', 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=500&auto=format', NOW()),
(35, 'LogMeIn', 'contact@logmein.com', 'BUSINESS', 'ACTIVE', '320 Summer Street, Boston, MA 02210', '(617) 555-0135', 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=500&auto=format', NOW()),
(36, 'Christopher Young', 'christopher.young@gmail.com', 'INDIVIDUAL', 'ACTIVE', '123 Dorchester, Boston, MA 02122', '(617) 555-0136', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format', NOW()),
(37, 'Susan King', 'susan.king@yahoo.com', 'INDIVIDUAL', 'ACTIVE', '456 Roxbury, Boston, MA 02119', '(617) 555-0137', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format', NOW()),
(38, 'Joseph Wright', 'joseph.wright@hotmail.com', 'INDIVIDUAL', 'ACTIVE', '789 East Boston, Boston, MA 02128', '(617) 555-0138', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format', NOW()),
(39, 'Karen Lopez', 'karen.lopez@outlook.com', 'INDIVIDUAL', 'ACTIVE', '321 Brighton, Boston, MA 02135', '(617) 555-0139', 'https://images.unsplash.com/photo-1494790108377-be9c29d29330?w=500&auto=format', NOW()),
(40, 'Steven Hill', 'steven.hill@gmail.com', 'INDIVIDUAL', 'ACTIVE', '654 Allston, Boston, MA 02134', '(617) 555-0140', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format', NOW()),
(41, 'Liberty Mutual', 'contact@libertymutual.com', 'BUSINESS', 'ACTIVE', '175 Berkeley Street, Boston, MA 02116', '(617) 555-0141', 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=500&auto=format', NOW()),
(42, 'John Hancock', 'info@johnhancock.com', 'BUSINESS', 'ACTIVE', '200 Berkeley Street, Boston, MA 02116', '(617) 555-0142', 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=500&auto=format', NOW()),
(43, 'Santander Bank', 'contact@santander.com', 'BUSINESS', 'ACTIVE', '75 State Street, Boston, MA 02109', '(617) 555-0143', 'https://images.unsplash.com/photo-1560520653-9e0e4c89eb11?w=500&auto=format', NOW()),
(44, 'Boston Properties', 'info@bostonproperties.com', 'BUSINESS', 'ACTIVE', '800 Boylston Street, Boston, MA 02199', '(617) 555-0144', 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=500&auto=format', NOW()),
(45, 'Wellington Management', 'contact@wellington.com', 'BUSINESS', 'ACTIVE', '280 Congress Street, Boston, MA 02210', '(617) 555-0145', 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=500&auto=format', NOW()),
(46, 'Edward Scott', 'edward.scott@gmail.com', 'INDIVIDUAL', 'ACTIVE', '123 Brookline, Brookline, MA 02445', '(617) 555-0146', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format', NOW()),
(47, 'Betty Green', 'betty.green@yahoo.com', 'INDIVIDUAL', 'ACTIVE', '456 Newton, Newton, MA 02458', '(617) 555-0147', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format', NOW()),
(48, 'Ronald Baker', 'ronald.baker@hotmail.com', 'INDIVIDUAL', 'ACTIVE', '789 Cambridge, Cambridge, MA 02138', '(617) 555-0148', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format', NOW()),
(49, 'Dorothy Adams', 'dorothy.adams@outlook.com', 'INDIVIDUAL', 'ACTIVE', '321 Somerville, Somerville, MA 02143', '(617) 555-0149', 'https://images.unsplash.com/photo-1494790108377-be9c29d29330?w=500&auto=format', NOW()),
(50, 'George Nelson', 'george.nelson@gmail.com', 'INDIVIDUAL', 'ACTIVE', '654 Medford, Medford, MA 02155', '(617) 555-0150', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format', NOW()),
(51, 'Amazon', 'contact@amazon.com', 'BUSINESS', 'ACTIVE', '101 Federal Street, Boston, MA 02110', '(617) 555-0151', 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=500&auto=format', NOW()),
(52, 'Google', 'info@google.com', 'BUSINESS', 'ACTIVE', '355 Main Street, Cambridge, MA 02142', '(617) 555-0152', 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=500&auto=format', NOW()),
(53, 'Microsoft', 'contact@microsoft.com', 'BUSINESS', 'ACTIVE', '255 Main Street, Cambridge, MA 02142', '(617) 555-0153', 'https://images.unsplash.com/photo-1560520653-9e0e4c89eb11?w=500&auto=format', NOW()),
(54, 'Apple', 'info@apple.com', 'BUSINESS', 'ACTIVE', '1 Infinite Loop, Cupertino, CA 95014', '(408) 555-0154', 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=500&auto=format', NOW()),
(55, 'Facebook', 'contact@facebook.com', 'BUSINESS', 'ACTIVE', '1 Hacker Way, Menlo Park, CA 94025', '(650) 555-0155', 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=500&auto=format', NOW()),
(56, 'Kenneth Carter', 'kenneth.carter@gmail.com', 'INDIVIDUAL', 'ACTIVE', '123 Arlington, Arlington, MA 02474', '(781) 555-0156', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format', NOW()),
(57, 'Helen Mitchell', 'helen.mitchell@yahoo.com', 'INDIVIDUAL', 'ACTIVE', '456 Belmont, Belmont, MA 02478', '(617) 555-0157', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format', NOW()),
(58, 'Paul Turner', 'paul.turner@hotmail.com', 'INDIVIDUAL', 'ACTIVE', '789 Watertown, Watertown, MA 02472', '(617) 555-0158', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format', NOW()),
(59, 'Margaret Phillips', 'margaret.phillips@outlook.com', 'INDIVIDUAL', 'ACTIVE', '321 Waltham, Waltham, MA 02451', '(781) 555-0159', 'https://images.unsplash.com/photo-1494790108377-be9c29d29330?w=500&auto=format', NOW()),
(60, 'Frank Evans', 'frank.evans@gmail.com', 'INDIVIDUAL', 'ACTIVE', '654 Lexington, Lexington, MA 02420', '(781) 555-0160', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format', NOW()),
(61, 'Boston Red Sox', 'contact@redsox.com', 'BUSINESS', 'ACTIVE', '4 Jersey Street, Boston, MA 02215', '(617) 555-0161', 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=500&auto=format', NOW()),
(62, 'Boston Celtics', 'info@celtics.com', 'BUSINESS', 'ACTIVE', '1 Causeway Street, Boston, MA 02114', '(617) 555-0162', 'https://images.unsplash.com/photo-1560520653-9e0e4c89eb11?w=500&auto=format', NOW()),
(63, 'Boston Bruins', 'contact@bruins.com', 'BUSINESS', 'ACTIVE', '100 Legends Way, Boston, MA 02114', '(617) 555-0163', 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=500&auto=format', NOW()),
(64, 'New England Patriots', 'info@patriots.com', 'BUSINESS', 'ACTIVE', '1 Patriot Place, Foxborough, MA 02035', '(508) 555-0164', 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=500&auto=format', NOW()),
(65, 'New England Revolution', 'contact@revolutionsoccer.com', 'BUSINESS', 'ACTIVE', '1915 Revolution Way, Foxborough, MA 02035', '(508) 555-0165', 'https://images.unsplash.com/photo-1560520653-9e0e4c89eb11?w=500&auto=format', NOW()),
(66, 'Gary Rogers', 'gary.rogers@gmail.com', 'INDIVIDUAL', 'ACTIVE', '123 Concord, Concord, MA 01742', '(978) 555-0166', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format', NOW()),
(67, 'Deborah Reed', 'deborah.reed@yahoo.com', 'INDIVIDUAL', 'ACTIVE', '456 Acton, Acton, MA 01720', '(978) 555-0167', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format', NOW()),
(68, 'Timothy Cook', 'timothy.cook@hotmail.com', 'INDIVIDUAL', 'ACTIVE', '789 Bedford, Bedford, MA 01730', '(781) 555-0168', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format', NOW()),
(69, 'Sharon Morgan', 'sharon.morgan@outlook.com', 'INDIVIDUAL', 'ACTIVE', '321 Burlington, Burlington, MA 01803', '(781) 555-0169', 'https://images.unsplash.com/photo-1494790108377-be9c29d29330?w=500&auto=format', NOW()),
(70, 'Larry Bell', 'larry.bell@gmail.com', 'INDIVIDUAL', 'ACTIVE', '654 Billerica, Billerica, MA 01821', '(978) 555-0170', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format', NOW()),
(71, 'Boston Symphony Orchestra', 'contact@bso.org', 'BUSINESS', 'ACTIVE', '301 Massachusetts Avenue, Boston, MA 02115', '(617) 555-0171', 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=500&auto=format', NOW()),
(72, 'Museum of Fine Arts', 'info@mfa.org', 'BUSINESS', 'ACTIVE', '465 Huntington Avenue, Boston, MA 02115', '(617) 555-0172', 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=500&auto=format', NOW()),
(73, 'Boston Public Library', 'contact@bpl.org', 'BUSINESS', 'ACTIVE', '700 Boylston Street, Boston, MA 02116', '(617) 555-0173', 'https://images.unsplash.com/photo-1560520653-9e0e4c89eb11?w=500&auto=format', NOW()),
(74, 'New England Aquarium', 'info@neaq.org', 'BUSINESS', 'ACTIVE', '1 Central Wharf, Boston, MA 02110', '(617) 555-0174', 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=500&auto=format', NOW()),
(75, 'Boston Children''s Museum', 'contact@bostonchildrensmuseum.org', 'BUSINESS', 'ACTIVE', '308 Congress Street, Boston, MA 02210', '(617) 555-0175', 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=500&auto=format', NOW()),
(76, 'Jeffrey Cooper', 'jeffrey.cooper@gmail.com', 'INDIVIDUAL', 'ACTIVE', '123 Chelmsford, Chelmsford, MA 01824', '(978) 555-0176', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format', NOW()),
(77, 'Laura Richardson', 'laura.richardson@yahoo.com', 'INDIVIDUAL', 'ACTIVE', '456 Dracut, Dracut, MA 01826', '(978) 555-0177', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format', NOW()),
(78, 'Kevin Cox', 'kevin.cox@hotmail.com', 'INDIVIDUAL', 'ACTIVE', '789 Dunstable, Dunstable, MA 01827', '(978) 555-0178', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format', NOW()),
(79, 'Nancy Howard', 'nancy.howard@outlook.com', 'INDIVIDUAL', 'ACTIVE', '321 Groton, Groton, MA 01450', '(978) 555-0179', 'https://images.unsplash.com/photo-1494790108377-be9c29d29330?w=500&auto=format', NOW()),
(80, 'Steven Ward', 'steven.ward@gmail.com', 'INDIVIDUAL', 'ACTIVE', '654 Lowell, Lowell, MA 01851', '(978) 555-0180', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format', NOW()),
(81, 'Boston Consulting Group', 'contact@bcg.com', 'BUSINESS', 'ACTIVE', '200 Pier Four Blvd, Boston, MA 02210', '(617) 555-0181', 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=500&auto=format', NOW()),
(82, 'McKinsey & Company', 'info@mckinsey.com', 'BUSINESS', 'ACTIVE', '100 Federal Street, Boston, MA 02110', '(617) 555-0182', 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=500&auto=format', NOW()),
(83, 'Bain & Company', 'contact@bain.com', 'BUSINESS', 'ACTIVE', '131 Dartmouth Street, Boston, MA 02116', '(617) 555-0183', 'https://images.unsplash.com/photo-1560520653-9e0e4c89eb11?w=500&auto=format', NOW()),
(84, 'Deloitte', 'info@deloitte.com', 'BUSINESS', 'ACTIVE', '200 Berkeley Street, Boston, MA 02116', '(617) 555-0184', 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=500&auto=format', NOW()),
(85, 'PricewaterhouseCoopers', 'contact@pwc.com', 'BUSINESS', 'ACTIVE', '101 Seaport Blvd, Boston, MA 02210', '(617) 555-0185', 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=500&auto=format', NOW()),
(86, 'Angela Torres', 'angela.torres@gmail.com', 'INDIVIDUAL', 'ACTIVE', '123 Marlborough, Marlborough, MA 01752', '(508) 555-0186', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format', NOW()),
(87, 'Gregory Peterson', 'gregory.peterson@yahoo.com', 'INDIVIDUAL', 'ACTIVE', '456 Maynard, Maynard, MA 01754', '(978) 555-0187', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format', NOW()),
(88, 'Ruth James', 'ruth.james@hotmail.com', 'INDIVIDUAL', 'ACTIVE', '789 Natick, Natick, MA 01760', '(508) 555-0188', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format', NOW()),
(89, 'Jerry Watson', 'jerry.watson@outlook.com', 'INDIVIDUAL', 'ACTIVE', '321 Northborough, Northborough, MA 01532', '(508) 555-0189', 'https://images.unsplash.com/photo-1494790108377-be9c29d29330?w=500&auto=format', NOW()),
(90, 'Sandra Brooks', 'sandra.brooks@gmail.com', 'INDIVIDUAL', 'ACTIVE', '654 Shrewsbury, Shrewsbury, MA 01545', '(508) 555-0190', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format', NOW()),
(91, 'Boston Scientific', 'contact@bostonscientific.com', 'BUSINESS', 'ACTIVE', '300 Boston Scientific Way, Marlborough, MA 01752', '(508) 555-0191', 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=500&auto=format', NOW()),
(92, 'Thermo Fisher Scientific', 'info@thermofisher.com', 'BUSINESS', 'ACTIVE', '168 Third Avenue, Waltham, MA 02451', '(781) 555-0192', 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=500&auto=format', NOW()),
(93, 'Moderna', 'contact@moderna.com', 'BUSINESS', 'ACTIVE', '200 Technology Square, Cambridge, MA 02139', '(617) 555-0193', 'https://images.unsplash.com/photo-1560520653-9e0e4c89eb11?w=500&auto=format', NOW()),
(94, 'Vertex Pharmaceuticals', 'info@vrtx.com', 'BUSINESS', 'ACTIVE', '50 Northern Avenue, Boston, MA 02210', '(617) 555-0194', 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=500&auto=format', NOW()),
(95, 'Novartis', 'contact@novartis.com', 'BUSINESS', 'ACTIVE', '220 Massachusetts Avenue, Cambridge, MA 02139', '(617) 555-0195', 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=500&auto=format', NOW()),
(96, 'Dennis Barnes', 'dennis.barnes@gmail.com', 'INDIVIDUAL', 'ACTIVE', '123 Southborough, Southborough, MA 01772', '(508) 555-0196', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format', NOW()),
(97, 'Carol Ross', 'carol.ross@yahoo.com', 'INDIVIDUAL', 'ACTIVE', '456 Sudbury, Sudbury, MA 01776', '(978) 555-0197', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format', NOW()),
(98, 'Eric Henderson', 'eric.henderson@hotmail.com', 'INDIVIDUAL', 'ACTIVE', '789 Westborough, Westborough, MA 01581', '(508) 555-0198', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format', NOW()),
(99, 'Michelle Coleman', 'michelle.coleman@outlook.com', 'INDIVIDUAL', 'ACTIVE', '321 Westford, Westford, MA 01886', '(978) 555-0199', 'https://images.unsplash.com/photo-1494790108377-be9c29d29330?w=500&auto=format', NOW()),
(100, 'Stephen Jenkins', 'stephen.jenkins@gmail.com', 'INDIVIDUAL', 'ACTIVE', '654 Worcester, Worcester, MA 01608', '(508) 555-0200', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format', NOW());

-- Insert invoices with realistic data (multiple per customer)
INSERT INTO Invoice (customer_id, invoice_number, total, status, services, date)
SELECT 
    id as customer_id,
    CONCAT('INV-2024-', LPAD(id, 3, '0'), '-01') as invoice_number,
    ROUND(1000 + RAND() * 9000, 2) as total,
    CASE 
        WHEN id % 3 = 0 THEN 'PAID'
        WHEN id % 3 = 1 THEN 'PENDING'
        ELSE 'OVERDUE'
    END as status,
    CASE 
        WHEN id % 5 = 0 THEN 'Legal Services'
        WHEN id % 5 = 1 THEN 'Consulting Services'
        WHEN id % 5 = 2 THEN 'Design Services'
        WHEN id % 5 = 3 THEN 'Marketing Services'
        ELSE 'Technical Support'
    END as services,
    DATE_SUB(NOW(), INTERVAL FLOOR(1 + RAND() * 60) DAY) as date
FROM Customer;

-- Insert second invoice for each customer
INSERT INTO Invoice (customer_id, invoice_number, total, status, services, date)
SELECT 
    id as customer_id,
    CONCAT('INV-2024-', LPAD(id, 3, '0'), '-02') as invoice_number,
    ROUND(500 + RAND() * 5000, 2) as total,
    CASE 
        WHEN id % 3 = 0 THEN 'PENDING'
        WHEN id % 3 = 1 THEN 'PAID'
        ELSE 'OVERDUE'
    END as status,
    CASE 
        WHEN id % 5 = 0 THEN 'Web Development'
        WHEN id % 5 = 1 THEN 'Financial Advisory'
        WHEN id % 5 = 2 THEN 'Content Creation'
        WHEN id % 5 = 3 THEN 'SEO Services'
        ELSE 'IT Support'
    END as services,
    DATE_SUB(NOW(), INTERVAL FLOOR(1 + RAND() * 30) DAY) as date
FROM Customer;

-- Insert third invoice for each customer
INSERT INTO Invoice (customer_id, invoice_number, total, status, services, date)
SELECT 
    id as customer_id,
    CONCAT('INV-2024-', LPAD(id, 3, '0'), '-03') as invoice_number,
    ROUND(2000 + RAND() * 8000, 2) as total,
    CASE 
        WHEN id % 3 = 0 THEN 'OVERDUE'
        WHEN id % 3 = 1 THEN 'PENDING'
        ELSE 'PAID'
    END as status,
    CASE 
        WHEN id % 5 = 0 THEN 'Project Management'
        WHEN id % 5 = 1 THEN 'HR Consulting'
        WHEN id % 5 = 2 THEN 'Brand Strategy'
        WHEN id % 5 = 3 THEN 'Social Media Management'
        ELSE 'Cloud Services'
    END as services,
    DATE_SUB(NOW(), INTERVAL FLOOR(1 + RAND() * 90) DAY) as date
FROM Customer; 