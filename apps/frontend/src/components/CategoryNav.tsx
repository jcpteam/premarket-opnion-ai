/**
 * Category Navigation Component
 * Quick navigation between market categories
 * 
 * Requirements: 6.3
 */

'use client';

interface CategoryNavProps {
  selectedCategory: string;
  onCategorySelect: (category: string) => void;
}

const CATEGORIES = [
  { value: '', label: 'All', icon: '🌐' },
  { value: 'Politics', label: 'Politics', icon: '🏛️' },
  { value: 'Sports', label: 'Sports', icon: '⚽' },
  { value: 'Crypto', label: 'Crypto', icon: '₿' },
  { value: 'Technology', label: 'Tech', icon: '💻' },
  { value: 'Entertainment', label: 'Entertainment', icon: '🎬' },
  { value: 'Finance', label: 'Finance', icon: '💰' },
  { value: 'Science', label: 'Science', icon: '🔬' },
];

export function CategoryNav({ selectedCategory, onCategorySelect }: CategoryNavProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {CATEGORIES.map((category) => (
          <button
            key={category.value}
            onClick={() => onCategorySelect(category.value)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
              selectedCategory === category.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <span className="text-lg">{category.icon}</span>
            <span>{category.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
