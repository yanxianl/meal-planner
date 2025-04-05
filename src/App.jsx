import React, { useState, useEffect } from 'react';
import { format, addDays, startOfWeek, isBefore, setHours, setMinutes } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const meals = ['早', '中', '晚'];
const mealDeadlines = [6, 9, 14];

const MealPlanner = () => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [data, setData] = useState(() => JSON.parse(localStorage.getItem('mealData')) || {});
  const [names, setNames] = useState(() => JSON.parse(localStorage.getItem('mealNames')) || [{ name: '', count: 1 }]);

  useEffect(() => {
    localStorage.setItem('mealData', JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    localStorage.setItem('mealNames', JSON.stringify(names));
  }, [names]);

  const startDay = startOfWeek(currentWeek, { weekStartsOn: 1 });

  const handleCheck = (idx, day, meal) => {
    const key = `${idx}-${format(day, 'yyyy-MM-dd')}-${meal}`;
    setData((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const getMealCount = (day, meal) => {
    return names.reduce((sum, _, idx) => sum + (data[`${idx}-${format(day, 'yyyy-MM-dd')}-${meal}`] ? names[idx].count : 0), 0);
  };

  const canCheck = (day, mealIdx) => {
    const deadline = setMinutes(setHours(day, mealDeadlines[mealIdx]), 0);
    return isBefore(new Date(), deadline);
  };

  const updateCount = (idx) => {
    const input = prompt("请输入用餐人数:", names[idx].count);
    const newCount = parseInt(input, 10);
    if (!isNaN(newCount) && newCount > 0) {
      setNames(names.map((item, i) => (i === idx ? { ...item, count: newCount } : item)));
    }
  };

  return (
    <div className="p-6 font-sans max-w-full overflow-x-auto">
      <h2 className="text-3xl font-bold mb-6 text-center">升龙公司德合厂用餐计划表</h2>
      <div className="flex items-center justify-between mb-6">
        <ChevronLeft className="cursor-pointer" onClick={() => setCurrentWeek(addDays(currentWeek, -7))} />
        <span className="text-xl font-semibold">
          {format(startDay, 'dd/MM/yyyy')} - {format(addDays(startDay, 6), 'dd/MM/yyyy')}
        </span>
        <ChevronRight className="cursor-pointer" onClick={() => setCurrentWeek(addDays(currentWeek, 7))} />
      </div>

      <table className="min-w-full border border-gray-300">
        <thead className="bg-gray-100">
          <tr>
            <th className="border p-2" rowSpan={2}>姓名</th>
            <th className="border p-2" rowSpan={2}>用餐人数</th>
            {[...Array(7)].map((_, idx) => (
              <th key={idx} className="border p-2" colSpan={3}>
                {format(addDays(startDay, idx), 'dd/MM EEE', { locale: zhCN })}
              </th>
            ))}
          </tr>
          <tr>
            {[...Array(7)].map((_, idx) => (
              meals.map(meal => (
                <th key={`${idx}-${meal}`} className="border p-1 bg-gray-50">{meal}</th>
              ))
            ))}
          </tr>
        </thead>
        <tbody>
          {names.map((user, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              <td className="border p-2">{user.name || <span className="text-gray-400">未填写姓名</span>}</td>
              <td className="border p-2">{user.count}</td>
              {[...Array(7)].map((_, dayIdx) => (
                meals.map((meal, mealIdx) => {
                  const day = addDays(startDay, dayIdx);
                  return (
                    <td key={`${dayIdx}-${meal}`} className="border p-1">
                      <input
                        type="checkbox"
                        disabled={!canCheck(day, mealIdx)}
                        checked={data[`${idx}-${format(day, 'yyyy-MM-dd')}-${meal}`] || false}
                        onChange={() => handleCheck(idx, day, meal)}
                      />
                    </td>
                  );
                })
              ))}
            </tr>
          ))}
          <tr className="bg-gray-200 font-bold">
            <td className="border p-2" colSpan={2}>合计人数</td>
            {[...Array(7)].map((_, dayIdx) => (
              meals.map((meal, mealIdx) => (
                <td key={`total-${dayIdx}-${meal}`} className="border p-1">
                  {getMealCount(addDays(startDay, dayIdx), meal)}
                </td>
              ))
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default MealPlanner;
