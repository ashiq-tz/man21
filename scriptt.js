const products = [
    {
      id: 1,
      name: "Running Sneakers",
      brand: "Nike",
      color: "Black",
      price: "$129.99",
      image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80",
      isWishlist: false
    },
    {
      id: 2,
      name: "Sport Walker",
      brand: "Adidas",
      color: "White/Blue",
      price: "$99.99",
      image: "https://images.unsplash.com/photo-1608231387042-66d1773070a5?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80",
      isWishlist: false
    },
    {
      id: 3,
      name: "Classic Leather",
      brand: "Puma",
      color: "Brown",
      price: "$89.99",
      image: "https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80",
      isWishlist: false
    },
    {
      id: 4,
      name: "Urban Trainer",
      brand: "Reebok",
      color: "Grey",
      price: "$79.99",
      image: "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80",
      isWishlist: false
    },
    {
      id: 5,
      name: "Hiking Boots",
      brand: "Timberland",
      color: "Tan",
      price: "$149.99",
      image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80",
      isWishlist: false
    },
    {
      id: 6,
      name: "Casual Slip-On",
      brand: "Vans",
      color: "Black/White",
      price: "$59.99",
      image: "https://images.unsplash.com/photo-1543508282-6319a3e2621f?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80",
      isWishlist: false
    },
    {
      id: 7,
      name: "Outdoor Trail",
      brand: "North Face",
      color: "Green/Black",
      price: "$119.99",
      image: "https://images.unsplash.com/photo-1560769629-975ec94e6a86?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80",
      isWishlist: false
    },
    {
      id: 8,
      name: "Formal Oxford",
      brand: "Clarks",
      color: "Black",
      price: "$109.99",
      image: "https://images.unsplash.com/photo-1491553895911-0055eca6402d?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80",
      isWishlist: false
    },
    {
      id: 9,
      name: "Skate Pro",
      brand: "DC",
      color: "Red/White",
      price: "$69.99",
      image: "https://images.unsplash.com/photo-1607522370275-f14206abe5d3?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80",
      isWishlist: false
    }
  ];
  
  // Variables for pagination
  let currentPage = 1;
  const productsPerPage = 6;
  let displayedProducts = [...products];
  
  // DOM elements
  const productGrid = document.getElementById('product-grid');
  const prevPageBtn = document.getElementById('prev-page');
  const nextPageBtn = document.getElementById('next-page');
  const paginationNumbers = document.getElementById('pagination-numbers');
  const sortDropdown = document.querySelector('.sort-dropdown');
  const selectedSort = document.querySelector('.selected-sort');
  const sortOptions = document.querySelector('.sort-options');
  
  // Handle sort dropdown toggle
  selectedSort.addEventListener('click', () => {
    sortOptions.style.display = sortOptions.style.display === 'none' ? 'block' : 'none';
  });
  
  // Handle sort option click
  document.querySelectorAll('.sort-option').forEach(option => {
    option.addEventListener('click', () => {
      const sortValue = option.getAttribute('data-sort');
      sortProducts(sortValue);
      
      // Update selected sort text
      selectedSort.innerHTML = option.textContent + ' <i class="ti ti-chevron-down"></i>';
      sortOptions.style.display = 'none';
    });
  });
  
  // Handle document click to close sort dropdown when clicking outside
  document.addEventListener('click', event => {
    if (!sortDropdown.contains(event.target)) {
      sortOptions.style.display = 'none';
    }
  });
  
  // Sort products
  function sortProducts(sortBy) {
    switch(sortBy) {
      case 'price-low':
        displayedProducts.sort((a, b) => parseFloat(a.price.substring(1)) - parseFloat(b.price.substring(1)));
        break;
      case 'price-high':
        displayedProducts.sort((a, b) => parseFloat(b.price.substring(1)) - parseFloat(a.price.substring(1)));
        break;
      case 'newest':
        // For demo purposes, we'll just reverse the array
        displayedProducts.reverse();
        break;
      default:
        // Featured - use original order
        displayedProducts = [...products];
    }
    
    renderProducts();
  }
  
  // Render products based on current page
  function renderProducts() {
    const startIndex = (currentPage - 1) * productsPerPage;
    const endIndex = startIndex + productsPerPage;
    const paginatedProducts = displayedProducts.slice(startIndex, endIndex);
    
    // Clear product grid
    productGrid.innerHTML = '';
    
    // Add products to grid
    paginatedProducts.forEach(product => {
      const productCard = document.createElement('div');
      productCard.className = 'product-card';
      productCard.innerHTML = `
        <img src="${product.image}" alt="${product.name}" class="product-image">
        <div class="wishlist-button ${product.isWishlist ? 'active' : ''}">
          <i class="ti ti-heart"></i>
        </div>
        <div class="product-details">
          <div class="product-brand">${product.brand}</div>
          <div class="product-name">${product.name}</div>
          <div class="product-color">${product.color}</div>
          <div class="product-price">${product.price}</div>
        </div>
      `;
      
      // Add wishlist functionality
      const wishlistBtn = productCard.querySelector('.wishlist-button');
      wishlistBtn.addEventListener('click', () => {
        product.isWishlist = !product.isWishlist;
        wishlistBtn.classList.toggle('active');
      });
      
      productGrid.appendChild(productCard);
    });
    
    // Update pagination
    updatePagination();
  }
  
  // Update pagination controls
  function updatePagination() {
    const totalPages = Math.ceil(displayedProducts.length / productsPerPage);
    
    // Clear pagination numbers
    paginationNumbers.innerHTML = '';
    
    // Generate page numbers
    for (let i = 1; i <= totalPages; i++) {
      const pageNumber = document.createElement('div');
      pageNumber.className = `page-number ${currentPage === i ? 'active' : ''}`;
      pageNumber.textContent = i;
      pageNumber.addEventListener('click', () => {
        currentPage = i;
        renderProducts();
      });
      paginationNumbers.appendChild(pageNumber);
    }
    
    // Update prev/next buttons
    prevPageBtn.classList.toggle('disabled', currentPage === 1);
    nextPageBtn.classList.toggle('disabled', currentPage === totalPages);
  }
  
  // Handle prev/next page clicks
  prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderProducts();
    }
  });
  
  nextPageBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(displayedProducts.length / productsPerPage);
    if (currentPage < totalPages) {
      currentPage++;
      renderProducts();
    }
  });
  
  // Initial render
  renderProducts();
  
  // Handle filter dropdowns (for demo purposes)
  document.querySelectorAll('.filter-item').forEach(item => {
    item.addEventListener('click', () => {
      console.log(`Filter ${item.getAttribute('data-filter')} clicked`);
      // In a real application, you would show a dropdown with filter options here
    });
  });
  